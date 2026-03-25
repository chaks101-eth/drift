import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getLlm, getModel, withRetry, throttleLlm } from '@/lib/ai-agent'
import { URL_EXTRACTION_SYSTEM_PROMPT } from '@/lib/ai-prompts'
import { rateLimit } from '@/lib/rate-limit'
import { groundedDestinationSearch } from '@/lib/grounded-search'
import { getDestinationPhoto } from '@/lib/google-places-photos'
import type OpenAI from 'openai'

// POST /api/ai/extract-url — extract travel data from a URL
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { allowed } = rateLimit(ip, { limit: 10, windowMs: 60_000 })
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  console.log(`[ExtractURL] Processing: ${url}`)
  const start = Date.now()

  try {
    // ─── Detect URL type and extract content ─────────────────
    const urlType = detectUrlType(url)
    let contentText = ''
    let thumbnailBase64: string | null = null
    const sourceType: 'youtube' | 'instagram' | 'tiktok' | 'article' = urlType

    if (urlType === 'instagram') {
      const igData = await extractInstagramContent(url)
      contentText = igData.text
      thumbnailBase64 = igData.thumbnailBase64
    } else if (urlType === 'youtube') {
      contentText = await extractYouTubeContent(url)
    } else if (urlType === 'tiktok') {
      contentText = await extractTikTokContent(url)
    } else {
      contentText = await extractArticleContent(url)
    }

    if (!contentText || contentText.length < 20) {
      // Last resort: use Gemini grounded search to understand the URL
      const apiKey = process.env.GEMINI_API_KEY
      if (apiKey) {
        try {
          console.log(`[ExtractURL] Content too short, trying grounded search for URL context`)
          const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
          const gRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `What travel content is at this URL? Find the destinations, hotels, restaurants, and activities mentioned: ${url}` }] }],
              tools: [{ google_search: {} }],
            }),
          })
          if (gRes.ok) {
            const gData = await gRes.json()
            const gText = gData.candidates?.[0]?.content?.parts?.[0]?.text || ''
            if (gText.length > 50) {
              contentText = `Source: ${sourceType} (${url})\n\nContent (verified via web search):\n${gText}`
              console.log(`[ExtractURL] Grounded fallback got ${gText.length} chars`)
            }
          }
        } catch (e) {
          console.warn(`[ExtractURL] Grounded URL fallback failed: ${e}`)
        }
      }

      if (!contentText || contentText.length < 20) {
        return NextResponse.json({
          error: 'Could not extract enough content from this URL. Try a travel reel, YouTube video, or blog post.',
        }, { status: 422 })
      }
    }

    // Truncate to ~8000 chars to stay within token limits
    if (contentText.length > 8000) {
      contentText = contentText.slice(0, 8000) + '...[truncated]'
    }

    console.log(`[ExtractURL] Extracted ${contentText.length} chars (${sourceType}), thumbnail: ${thumbnailBase64 ? 'yes' : 'no'}`)

    // ─── Send to Gemini for structured extraction ────────────
    const llm = getLlm()
    const model = getModel()

    const userContent: OpenAI.ChatCompletionContentPart[] = []

    if (thumbnailBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${thumbnailBase64}` },
      })
      userContent.push({
        type: 'text',
        text: `Extract travel data from this Instagram reel. Analyze BOTH the image and the text below.\n\nImage: This is the reel thumbnail — identify the location, landmarks, or travel setting shown.\n\nCaption & metadata:\n${contentText}`,
      })
    } else {
      const sourceLabel = sourceType === 'youtube' ? 'YouTube video transcript'
        : sourceType === 'instagram' ? 'Instagram reel caption'
        : sourceType === 'tiktok' ? 'TikTok video description'
        : 'article'
      userContent.push({
        type: 'text',
        text: `Extract travel data from this ${sourceLabel}:\n\n${contentText}`,
      })
    }

    await throttleLlm()
    const response = await withRetry(() => llm.chat.completions.create({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: URL_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }))

    const raw = response.choices[0].message.content || '{}'
    let cleaned = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) cleaned = jsonMatch[0]

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(cleaned)
    } catch {
      console.error('[ExtractURL] Failed to parse Gemini response (first 500 chars):', raw.slice(0, 500))

      // Retry with explicit JSON-only instruction
      try {
        console.log('[ExtractURL] Retrying with stricter JSON prompt...')
        await throttleLlm()
        const retry = await withRetry(() => llm.chat.completions.create({
          model,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: URL_EXTRACTION_SYSTEM_PROMPT },
            { role: 'user', content: [{ type: 'text', text: `Return ONLY a JSON object. No markdown, no explanation. First character must be {, last must be }.\n\nContent to extract from:\n${contentText.slice(0, 4000)}` }] },
          ],
        }))
        const retryRaw = retry.choices[0].message.content || '{}'
        const retryClean = retryRaw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
        const retryMatch = retryClean.match(/\{[\s\S]*\}/)
        extracted = JSON.parse(retryMatch ? retryMatch[0] : retryClean)
      } catch {
        return NextResponse.json({ error: 'Failed to parse travel data from content' }, { status: 500 })
      }
    }

    if (extracted.error === 'no_travel_content') {
      return NextResponse.json({
        error: 'This content doesn\'t seem to be about travel. Try a travel vlog, guide, or blog post.',
      }, { status: 422 })
    }

    // ─── Verify + enrich with grounded search & Google Places ──
    const destination = extracted.primaryDestination as string
    const extractedCountry = extracted.country as string

    if (destination) {
      // Run grounded verification + destination photo in parallel
      const [groundedResult, destPhoto] = await Promise.all([
        groundedDestinationSearch({
          destination,
          country: extractedCountry || '',
          vibes: (extracted.vibes as string[]) || [],
          budget: (extracted.budgetHint as string) || 'mid',
          travelers: 2,
          days: (extracted.suggestedDays as number) || 5,
        }).catch(() => null),
        getDestinationPhoto(destination, extractedCountry || '').catch(() => null),
      ])

      // Add verified place count and destination image
      if (groundedResult?.places.length) {
        const highlights = (extracted.highlights as Array<{ name: string }>) || []
        const verifiedCount = highlights.filter(h =>
          groundedResult.places.some(p =>
            p.name.toLowerCase().includes(h.name.toLowerCase().split(' ')[0]) ||
            h.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
          )
        ).length
        extracted.verifiedPlaces = verifiedCount
        extracted.totalGroundedPlaces = groundedResult.places.length
        console.log(`[ExtractURL] Grounded verification: ${verifiedCount}/${highlights.length} highlights verified`)
      }

      if (destPhoto) {
        extracted.destinationImage = destPhoto
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`[ExtractURL] Success in ${elapsed}s — destination: ${destination}, vibes: ${(extracted.vibes as string[])?.join(',')}`)

    return NextResponse.json({
      extracted: { ...extracted, sourceType },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.error(`[ExtractURL] Failed after ${elapsed}s: ${msg}`)
    return NextResponse.json({ error: `Extraction failed: ${msg}` }, { status: 500 })
  }
}

// ─── URL Type Detection ─────────────────────────────────────────

function detectUrlType(url: string): 'youtube' | 'instagram' | 'tiktok' | 'article' {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) return 'youtube'
    if (u.hostname.includes('instagram.com')) return 'instagram'
    if (u.hostname.includes('tiktok.com') || u.hostname.includes('vm.tiktok.com')) return 'tiktok'
    return 'article'
  } catch {
    return 'article'
  }
}

// ─── Instagram Extraction ───────────────────────────────────────

async function extractInstagramContent(url: string): Promise<{ text: string; thumbnailBase64: string | null }> {
  let caption = ''
  let author = ''
  let thumbnailUrl = ''

  const shortcode = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[2]
  if (!shortcode) throw new Error('Invalid Instagram URL')

  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`
  console.log(`[ExtractURL] Fetching Instagram embed: ${embedUrl}`)

  try {
    const res = await fetch(embedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    })

    if (res.ok) {
      const html = await res.text()

      const captionMatch = html.match(/class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/i)
      if (captionMatch) {
        caption = captionMatch[1]
          .replace(/<a[^>]*class="CaptionUsername"[^>]*>[^<]*<\/a>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&#064;/g, '@')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim()
      }

      const authorMatch = html.match(/class="CaptionUsername"[^>]*>([^<]+)</)
      if (authorMatch) author = authorMatch[1].trim()

      const imgMatch = html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/)
      if (imgMatch) {
        thumbnailUrl = imgMatch[1].replace(/&amp;/g, '&')
      }

      console.log(`[ExtractURL] Instagram embed: author="${author}", caption="${caption?.slice(0, 80)}...", thumbnail=${thumbnailUrl ? 'yes' : 'no'}`)
    }
  } catch (e) {
    console.warn(`[ExtractURL] Instagram embed error: ${e}`)
  }

  // Fetch thumbnail as base64 for multimodal analysis
  let thumbnailBase64: string | null = null
  if (thumbnailUrl) {
    try {
      const imgRes = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(8000) })
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer()
        thumbnailBase64 = Buffer.from(buffer).toString('base64')
        console.log(`[ExtractURL] Thumbnail fetched: ${Math.round(buffer.byteLength / 1024)}KB`)
      }
    } catch (e) {
      console.warn(`[ExtractURL] Thumbnail fetch error: ${e}`)
    }
  }

  const parts: string[] = []
  if (author) parts.push(`Author: @${author}`)
  if (caption) parts.push(`Caption: ${caption}`)
  parts.push(`Source: Instagram Reel`)

  if (!caption && !thumbnailBase64) {
    throw new Error('Could not extract content from this Instagram reel. Make sure it\'s a public reel.')
  }

  if (!caption && thumbnailBase64) {
    parts.push('Note: No caption text was available. Analyze the image to identify the travel destination, setting, and activities shown.')
  }

  return { text: parts.join('\n'), thumbnailBase64 }
}

// ─── YouTube Extraction ─────────────────────────────────────────

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    if (u.pathname.includes('/shorts/')) return u.pathname.split('/shorts/')[1]?.split(/[?/]/)[0]
    return u.searchParams.get('v')
  } catch {
    return null
  }
}

async function extractYouTubeContent(url: string): Promise<string> {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) throw new Error('Invalid YouTube URL')

  const apiKey = process.env.GEMINI_API_KEY

  // PRIMARY: Gemini direct video analysis — watches the actual video frame by frame
  if (apiKey) {
    try {
      console.log(`[ExtractURL] Analyzing YouTube video via Gemini video understanding: ${videoId}`)
      const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Watch this travel video carefully. For every frame, identify: destinations, hotels, restaurants, activities, landmarks, beaches, temples, markets, viewpoints, and any text/signs shown. List EVERY specific place name you can identify from the visuals and audio. Include the category (hotel/food/activity/sightseeing) for each.' },
              { fileData: { mimeType: 'video/mp4', fileUri: url } },
            ],
          }],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const videoAnalysis = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (videoAnalysis.length > 100) {
          console.log(`[ExtractURL] Video analysis: ${videoAnalysis.length} chars`)
          const title = await fetchYouTubeTitle(url)
          return `Source: YouTube Video (analyzed frame by frame)\n${title ? `Title: ${title}\n` : ''}URL: ${url}\n\nVideo content analysis:\n${videoAnalysis}`
        }
      }
    } catch (e) {
      console.warn(`[ExtractURL] Video analysis failed, trying transcript: ${e}`)
    }
  }

  // FALLBACK 1: Transcript
  const parts: string[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('youtube-transcript') as any
    const YT = mod.YoutubeTranscript || mod.default
    if (YT?.fetchTranscript) {
      const transcript = await YT.fetchTranscript(videoId)
      const text = transcript.map((t: { text: string }) => t.text).join(' ')
      if (text.length > 100) parts.push(`Transcript:\n${text}`)
    }
  } catch { /* skip */ }

  const title = await fetchYouTubeTitle(url)
  if (title) parts.unshift(`Title: ${title}`)

  if (parts.join('\n').length > 50) return parts.join('\n\n')

  // FALLBACK 2: Grounded search
  if (apiKey) {
    try {
      const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `What travel content is in this YouTube video? ${url}. List specific places.` }] }],
          tools: [{ google_search: {} }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text.length > 50) return `Source: YouTube Video\n\n${text}`
      }
    } catch { /* skip */ }
  }

  if (parts.length > 0) return parts.join('\n\n')
  throw new Error('Could not extract content from this YouTube video.')
}

async function fetchYouTubeTitle(url: string): Promise<string> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
    if (res.ok) {
      const data = await res.json()
      return data.title || ''
    }
  } catch { /* ignore */ }
  return ''
}

// ─── TikTok Extraction ──────────────────────────────────────────

async function extractTikTokContent(url: string): Promise<string> {
  // TikTok oEmbed API — works without auth, gives title + author
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) })
    if (res.ok) {
      const data = await res.json()
      const parts: string[] = []
      if (data.title) parts.push(`Title: ${data.title}`)
      if (data.author_name) parts.push(`Author: @${data.author_name}`)
      parts.push(`Source: TikTok`)
      parts.push(`URL: ${url}`)

      // Also try to fetch the page HTML for more context (description, hashtags)
      try {
        const pageRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(8000),
          redirect: 'follow',
        })
        if (pageRes.ok) {
          const html = await pageRes.text()
          // Extract description from meta tags
          const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)
          if (descMatch?.[1]) parts.push(`\nDescription: ${descMatch[1]}`)
          // Extract hashtags
          const hashtagMatches = html.match(/#[\w]+/g)
          if (hashtagMatches?.length) parts.push(`Hashtags: ${[...new Set(hashtagMatches)].slice(0, 15).join(' ')}`)
        }
      } catch { /* page fetch is best-effort */ }

      const text = parts.join('\n')
      if (text.length > 30) return text
    }
  } catch (e) {
    console.warn(`[ExtractURL] TikTok oEmbed failed: ${e}`)
  }

  // Fallback: try fetching page as article
  return extractArticleContent(url)
}

// ─── Article Extraction ─────────────────────────────────────────

async function extractArticleContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`)

  const html = await res.text()

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i)
  const ogDesc = ogDescMatch ? ogDescMatch[1] : ''

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return `Title: ${title}\nDescription: ${ogDesc}\n\nContent:\n${text}`
}

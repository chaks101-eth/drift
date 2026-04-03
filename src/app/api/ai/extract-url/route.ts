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

// ─── Video Download via Cobalt ──────────────────────────────────

const COBALT_URL = process.env.COBALT_URL || 'https://cobalt-production-31a7.up.railway.app'

async function downloadVideoViaCobalt(url: string): Promise<Buffer | null> {
  try {
    console.log(`[ExtractURL] Cobalt: downloading video...`)
    const res = await fetch(COBALT_URL + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    if (data.status === 'error' || !data.url) {
      console.warn(`[ExtractURL] Cobalt error: ${data.text || 'no url returned'}`)
      return null
    }
    console.log(`[ExtractURL] Cobalt: got video URL, downloading...`)
    const videoRes = await fetch(data.url, { signal: AbortSignal.timeout(15000) })
    if (!videoRes.ok) return null
    const buffer = Buffer.from(await videoRes.arrayBuffer())
    console.log(`[ExtractURL] Cobalt: downloaded ${Math.round(buffer.length / 1024)}KB`)
    return buffer
  } catch (e) {
    console.warn(`[ExtractURL] Cobalt failed: ${e}`)
    return null
  }
}

async function uploadToGeminiFileAPI(videoBuffer: Buffer): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Command': 'start, upload, finalize',
        'X-Goog-Upload-Header-Content-Length': String(videoBuffer.length),
        'X-Goog-Upload-Header-Content-Type': 'video/mp4',
        'Content-Type': 'video/mp4',
      },
      body: new Uint8Array(videoBuffer) as unknown as BodyInit,
    })
    const data = await res.json()
    const uri = data.file?.uri
    if (uri) console.log(`[ExtractURL] Gemini File API: uploaded, URI: ${uri}`)
    return uri || null
  } catch (e) {
    console.warn(`[ExtractURL] Gemini upload failed: ${e}`)
    return null
  }
}

async function analyzeVideoWithGemini(fileUri: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return ''

  // Wait briefly for video processing
  await new Promise(r => setTimeout(r, 3000))

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: 'Watch this travel video frame by frame. For each scene, identify the specific place, landmark, hotel, restaurant, market, beach, temple, or activity shown. Include text visible on signs, menus, and overlays. List every specific place name with its category (hotel/food/activity/sightseeing/nature/nightlife/shopping/cultural). Be exhaustive — this is for building a travel itinerary.' },
        { fileData: { mimeType: 'video/mp4', fileUri } },
      ] }],
    }),
  })
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── Instagram Extraction ───────────────────────────────────────

async function extractInstagramContent(url: string): Promise<{ text: string; thumbnailBase64: string | null }> {
  // PRIMARY: Download video via Cobalt → Gemini video analysis
  const videoBuffer = await downloadVideoViaCobalt(url)
  if (videoBuffer) {
    const fileUri = await uploadToGeminiFileAPI(videoBuffer)
    if (fileUri) {
      console.log(`[ExtractURL] Analyzing Instagram reel via Gemini video understanding...`)
      const analysis = await analyzeVideoWithGemini(fileUri)
      if (analysis.length > 100) {
        // Also try to get caption for extra context
        let caption = ''
        try {
          const shortcode = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[2]
          if (shortcode) {
            const embedRes = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, {
              headers: { 'User-Agent': BROWSER_UA },
              signal: AbortSignal.timeout(5000),
            })
            if (embedRes.ok) {
              const html = await embedRes.text()
              const captionMatch = html.match(/class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/i)
              if (captionMatch) {
                caption = captionMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
              }
            }
          }
        } catch { /* best effort */ }

        return {
          text: `Source: Instagram Reel (analyzed frame by frame)\nURL: ${url}${caption ? `\nCaption: ${caption}` : ''}\n\nVideo content analysis:\n${analysis}`,
          thumbnailBase64: null,
        }
      }
    }
  }

  // FALLBACK: Embed HTML parsing + thumbnail (old approach)
  console.log(`[ExtractURL] Video analysis unavailable, falling back to embed parsing`)
  let caption = ''
  let author = ''
  let thumbnailUrl = ''

  const shortcode = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[2]
  if (!shortcode) throw new Error('Invalid Instagram URL')

  try {
    const res = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const captionMatch = html.match(/class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/i)
      if (captionMatch) {
        caption = captionMatch[1].replace(/<a[^>]*class="CaptionUsername"[^>]*>[^<]*<\/a>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
      }
      const authorMatch = html.match(/class="CaptionUsername"[^>]*>([^<]+)</)
      if (authorMatch) author = authorMatch[1].trim()
      const imgMatch = html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/)
      if (imgMatch) thumbnailUrl = imgMatch[1].replace(/&amp;/g, '&')
    }
  } catch { /* skip */ }

  let thumbnailBase64: string | null = null
  if (thumbnailUrl) {
    try {
      const imgRes = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(8000) })
      if (imgRes.ok) thumbnailBase64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
    } catch { /* skip */ }
  }

  const parts: string[] = []
  if (author) parts.push(`Author: @${author}`)
  if (caption) parts.push(`Caption: ${caption}`)
  parts.push(`Source: Instagram Reel`)
  if (!caption && !thumbnailBase64) throw new Error('Could not extract content from this Instagram reel.')
  if (!caption && thumbnailBase64) parts.push('Note: No caption text. Analyze the image to identify the travel destination.')

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

  // PRIMARY: Download video via Cobalt → Gemini video analysis
  const videoBuffer = await downloadVideoViaCobalt(url)
  if (videoBuffer) {
    const fileUri = await uploadToGeminiFileAPI(videoBuffer)
    if (fileUri) {
      console.log(`[ExtractURL] Analyzing YouTube video via Gemini video understanding: ${videoId}`)
      const analysis = await analyzeVideoWithGemini(fileUri)
      if (analysis.length > 100) {
        const title = await fetchYouTubeTitle(url)
        return `Source: YouTube Video (analyzed frame by frame)\n${title ? `Title: ${title}\n` : ''}URL: ${url}\n\nVideo content analysis:\n${analysis}`
      }
    }
  }

  // FALLBACK 1: Transcript
  console.log(`[ExtractURL] YouTube video download unavailable, trying transcript for: ${videoId}`)
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
      console.log(`[ExtractURL] No transcript, trying grounded search for: ${videoId}`)
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
  throw new Error('Could not extract content from this YouTube video. Try a video with captions enabled.')
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
  // PRIMARY: Download video via Cobalt → Gemini video analysis
  const videoBuffer = await downloadVideoViaCobalt(url)
  if (videoBuffer) {
    const fileUri = await uploadToGeminiFileAPI(videoBuffer)
    if (fileUri) {
      console.log(`[ExtractURL] Analyzing TikTok via Gemini video understanding...`)
      const analysis = await analyzeVideoWithGemini(fileUri)
      if (analysis.length > 100) {
        // Get title via oEmbed for extra context
        let title = ''
        try {
          const oembed = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(5000) })
          if (oembed.ok) { const d = await oembed.json(); title = d.title || '' }
        } catch { /* skip */ }

        return `Source: TikTok (analyzed frame by frame)\nURL: ${url}${title ? `\nTitle: ${title}` : ''}\n\nVideo content analysis:\n${analysis}`
      }
    }
  }

  // FALLBACK: oEmbed + page scraping
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

      try {
        const pageRes = await fetch(url, {
          headers: { 'User-Agent': BROWSER_UA },
          signal: AbortSignal.timeout(8000),
          redirect: 'follow',
        })
        if (pageRes.ok) {
          const html = await pageRes.text()
          const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)
          if (descMatch?.[1]) parts.push(`\nDescription: ${descMatch[1]}`)
          const hashtagMatches = html.match(/#[\w]+/g)
          if (hashtagMatches?.length) parts.push(`Hashtags: ${[...new Set(hashtagMatches)].slice(0, 15).join(' ')}`)
        }
      } catch { /* skip */ }

      if (parts.join('\n').length > 30) return parts.join('\n')
    }
  } catch { /* skip */ }

  return extractArticleContent(url)
}

// ─── Article Extraction ─────────────────────────────────────────

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

async function extractArticleContent(url: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new Error('This site took too long to respond. Try a different URL or a direct blog link.')
    }
    throw new Error('Could not connect to this site. Check the URL and try again.')
  }

  if (res.status === 403) {
    throw new Error(`This site (${new URL(url).hostname}) blocks automated access. Try pasting a YouTube or Instagram link instead.`)
  }
  if (res.status === 401 || res.status === 402) {
    throw new Error('This content is behind a paywall or login. Try a publicly accessible link.')
  }
  if (!res.ok) {
    throw new Error(`This site returned an error (${res.status}). Try a different URL.`)
  }

  const html = await res.text()

  // Detect paywall indicators in HTML
  const paywallSignals = ['paywall', 'subscribe to read', 'premium content', 'sign in to continue', 'create an account to read']
  const htmlLower = html.toLowerCase()
  const isPaywalled = paywallSignals.some(s => htmlLower.includes(s)) && html.length < 5000

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

  if (isPaywalled && text.length < 500) {
    throw new Error('This content appears to be behind a paywall. Try a publicly accessible travel blog or video link.')
  }

  return `Title: ${title}\nDescription: ${ogDesc}\n\nContent:\n${text}`
}

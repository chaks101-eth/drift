import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getLlm, getModel, withRetry, throttleLlm } from '@/lib/ai-agent'
import { URL_EXTRACTION_SYSTEM_PROMPT } from '@/lib/ai-prompts'
import { rateLimit } from '@/lib/rate-limit'
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
    const sourceType: 'youtube' | 'instagram' | 'article' = urlType

    if (urlType === 'instagram') {
      const igData = await extractInstagramContent(url)
      contentText = igData.text
      thumbnailBase64 = igData.thumbnailBase64
    } else if (urlType === 'youtube') {
      contentText = await extractYouTubeContent(url)
    } else {
      contentText = await extractArticleContent(url)
    }

    if (!contentText || contentText.length < 20) {
      return NextResponse.json({
        error: 'Could not extract enough content from this URL. Try a travel reel, YouTube video, or blog post.',
      }, { status: 422 })
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
      userContent.push({
        type: 'text',
        text: `Extract travel data from this ${sourceType === 'youtube' ? 'YouTube video transcript' : sourceType === 'instagram' ? 'Instagram reel caption' : 'article'}:\n\n${contentText}`,
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
    let cleaned = raw.replace(/```(?:json)?\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) cleaned = jsonMatch[0]

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(cleaned)
    } catch {
      console.error('[ExtractURL] Failed to parse Gemini response:', raw.slice(0, 500))
      return NextResponse.json({ error: 'Failed to parse travel data from content' }, { status: 500 })
    }

    if (extracted.error === 'no_travel_content') {
      return NextResponse.json({
        error: 'This content doesn\'t seem to be about travel. Try a travel vlog, guide, or blog post.',
      }, { status: 422 })
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`[ExtractURL] Success in ${elapsed}s — destination: ${extracted.primaryDestination}, vibes: ${(extracted.vibes as string[])?.join(',')}`)

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

function detectUrlType(url: string): 'youtube' | 'instagram' | 'article' {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) return 'youtube'
    if (u.hostname.includes('instagram.com')) return 'instagram'
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

  // Try transcript first
  try {
    const { YoutubeTranscript } = await import('youtube-transcript')
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    const text = transcript.map((t: { text: string }) => t.text).join(' ')
    if (text.length > 100) {
      const title = await fetchYouTubeTitle(url)
      return `Title: ${title}\n\nTranscript:\n${text}`
    }
  } catch (e) {
    console.warn(`[ExtractURL] Transcript unavailable for ${videoId}: ${e}`)
  }

  // Fallback: oEmbed metadata
  const title = await fetchYouTubeTitle(url)
  if (title) {
    return `YouTube Video Title: ${title}\n\nNote: Full transcript was unavailable. Extract whatever travel information you can from the title.`
  }

  throw new Error('Could not extract content from this YouTube video')
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

// ─── Unsplash API Search ──────────────────────────────────────
// Used as a fallback in the pipeline when SerpAPI doesn't return photos.
// Free tier: 50 requests/hour (plenty for pipeline use)

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

interface UnsplashPhoto {
  urls: {
    raw: string
    full: string
    regular: string  // 1080px wide
    small: string    // 400px wide
    thumb: string    // 200px wide
  }
  alt_description: string | null
  user: { name: string; links: { html: string } }
}

/**
 * Search Unsplash for place-specific photos.
 * Returns direct CDN URLs at specified dimensions.
 * @param query - Search term, e.g. "Seminyak Beach Resort Bali"
 * @param count - Number of photos to return (max 10)
 * @param w - Desired width
 * @param h - Desired height
 */
export async function searchPhotos(
  query: string,
  count = 3,
  w = 800,
  h = 600,
): Promise<string[]> {
  if (!ACCESS_KEY) {
    console.warn('[Unsplash] No UNSPLASH_ACCESS_KEY set — skipping')
    return []
  }

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${Math.min(count, 10)}&orientation=landscape`
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
    })

    if (!res.ok) {
      console.warn(`[Unsplash] Search failed: ${res.status} ${res.statusText}`)
      return []
    }

    const data = await res.json()
    const photos = (data.results || []) as UnsplashPhoto[]

    // Use raw URL with size params for optimal quality
    return photos.map(p =>
      `${p.urls.raw}&w=${w}&h=${h}&fit=crop&auto=format&q=80`
    )
  } catch (e) {
    console.warn('[Unsplash] Search error:', e)
    return []
  }
}

/**
 * Get a fallback image for a catalog item.
 * Searches Unsplash with the item name + destination for specificity.
 */
export async function getPlaceFallbackPhotos(
  itemName: string,
  destination: string,
  category: string,
  count = 3,
): Promise<string[]> {
  // Build a specific query
  const catHint = category === 'hotel' ? 'hotel resort'
    : category === 'food' ? 'restaurant food'
    : 'travel landmark'

  // Try specific first, fall back to category + destination
  let photos = await searchPhotos(`${itemName} ${destination}`, count)
  if (photos.length === 0) {
    photos = await searchPhotos(`${catHint} ${destination}`, count)
  }
  return photos
}

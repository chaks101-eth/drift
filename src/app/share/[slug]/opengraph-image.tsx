import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: trip } = await db
    .from('trips')
    .select('destination, country, vibes, travelers, start_date, end_date')
    .eq('share_slug', slug)
    .single()

  if (!trip) {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', background: '#08080c', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#c8a44e', fontSize: 48, fontFamily: 'Georgia, serif', letterSpacing: 6 }}>DRIFT</span>
        </div>
      ),
      { ...size },
    )
  }

  const days = trip.start_date && trip.end_date
    ? Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)))
    : null

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column', background: '#08080c',
        width: '100%', height: '100%', padding: 60, justifyContent: 'center',
      }}>
        <div style={{ fontSize: 22, color: '#c8a44e', letterSpacing: 6, textTransform: 'uppercase' as const }}>
          DRIFT
        </div>
        <div style={{ fontSize: 64, color: '#f0efe8', marginTop: 16, fontWeight: 300, lineHeight: 1.1 }}>
          {trip.destination}{trip.country ? `, ${trip.country}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          {(trip.vibes || []).slice(0, 4).map((v: string) => (
            <span key={v} style={{
              border: '1px solid rgba(200,164,78,0.3)', borderRadius: 20,
              padding: '6px 16px', color: '#c8a44e', fontSize: 18,
            }}>
              {v}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 28, fontSize: 18, color: '#7a7a85' }}>
          {days && <span>{days} days</span>}
          <span>{trip.travelers} travelers</span>
        </div>
        <div style={{ marginTop: 40, fontSize: 14, color: '#4a4a55', letterSpacing: 2 }}>
          driftntravel.com
        </div>
      </div>
    ),
    { ...size },
  )
}

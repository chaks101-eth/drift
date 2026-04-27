import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'
import ShareTripView from './ShareTripView'
import { buildOverviewMapUrl } from '@/lib/day-maps'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Props = { params: Promise<{ slug: string }> }

/**
 * Looks up the creator's display name and avatar from auth metadata.
 * Returns nulls quietly if the user is gone or the creator opted out — the
 * share view will fall back to anonymous attribution.
 */
async function getCreator(userId: string | null): Promise<{ name: string | null; avatar: string | null }> {
  if (!userId) return { name: null, avatar: null }
  try {
    const { data } = await supabase.auth.admin.getUserById(userId)
    const meta = (data?.user?.user_metadata || {}) as Record<string, unknown>
    return {
      name: (meta.full_name as string) || (meta.name as string) || null,
      avatar: (meta.avatar_url as string) || (meta.picture as string) || null,
    }
  } catch {
    return { name: null, avatar: null }
  }
}

async function getTrip(slug: string) {
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('share_slug', slug)
    .single()

  if (!trip) return null

  const [{ data: items }, { count: heartCount }, creator] = await Promise.all([
    supabase.from('itinerary_items').select('*').eq('trip_id', trip.id).order('position'),
    supabase.from('reactions').select('id', { count: 'exact', head: true }).eq('trip_id', trip.id),
    getCreator(trip.user_id),
  ])

  // Build a single overview map across all stops (skip flights/transfers, only items with GPS).
  const stops = (items || [])
    .filter(i => i.category !== 'day' && i.category !== 'flight' && i.category !== 'transfer')
    .map(i => {
      const m = (i.metadata || {}) as Record<string, unknown>
      const lat = m.lat as number | undefined
      const lng = m.lng as number | undefined
      return lat && lng ? { lat, lng } : null
    })
    .filter((s): s is { lat: number; lng: number } => s !== null)
  const overviewMapUrl = stops.length > 0 ? buildOverviewMapUrl(stops) : null

  return { trip, items: items || [], heartCount: heartCount || 0, creator, overviewMapUrl }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getTrip(slug)
  if (!data) return { title: 'Trip not found — Drift' }

  const { trip } = data
  return {
    title: `${trip.destination}${trip.country && trip.country.toLowerCase() !== trip.destination?.toLowerCase() ? `, ${trip.country}` : ''} — Drift Trip`,
    description: `Check out this ${trip.vibes?.join(', ')} trip to ${trip.destination}! ${trip.travelers} travelers, ${trip.start_date} to ${trip.end_date}.`,
    openGraph: {
      title: `${trip.destination} Trip — Drift`,
      description: `A ${trip.vibes?.join(' & ')} trip to ${trip.destination}${trip.country && trip.country.toLowerCase() !== trip.destination?.toLowerCase() ? `, ${trip.country}` : ''}. Plan yours at drift.travel`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${trip.destination} Trip — Drift`,
      description: `A ${trip.vibes?.join(' & ')} trip to ${trip.destination}${trip.country && trip.country.toLowerCase() !== trip.destination?.toLowerCase() ? `, ${trip.country}` : ''}`,
    },
  }
}

export default async function SharePage({ params }: Props) {
  const { slug } = await params
  const data = await getTrip(slug)

  if (!data) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-3xl text-[#f0efe8] mb-2">Trip not found</h1>
          <p className="text-[#7a7a85]">This shared link may have expired or been removed.</p>
        </div>
      </div>
    )
  }

  return (
    <ShareTripView
      trip={data.trip}
      items={data.items}
      tripId={data.trip.id}
      heartCount={data.heartCount}
      creatorName={data.creator.name}
      creatorAvatar={data.creator.avatar}
      overviewMapUrl={data.overviewMapUrl}
    />
  )
}

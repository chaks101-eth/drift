import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'
import ShareTripView from './ShareTripView'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Props = { params: Promise<{ slug: string }> }

async function getTrip(slug: string) {
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('share_slug', slug)
    .single()

  if (!trip) return null

  const { data: items } = await supabase
    .from('itinerary_items')
    .select('*')
    .eq('trip_id', trip.id)
    .order('position')

  return { trip, items: items || [] }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getTrip(slug)
  if (!data) return { title: 'Trip not found — Drift' }

  const { trip } = data
  return {
    title: `${trip.destination}, ${trip.country} — Drift Trip`,
    description: `Check out this ${trip.vibes?.join(', ')} trip to ${trip.destination}! ${trip.travelers} travelers, ${trip.start_date} to ${trip.end_date}.`,
    openGraph: {
      title: `${trip.destination} Trip — Drift`,
      description: `A ${trip.vibes?.join(' & ')} trip to ${trip.destination}, ${trip.country}. Plan yours at drift.travel`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${trip.destination} Trip — Drift`,
      description: `A ${trip.vibes?.join(' & ')} trip to ${trip.destination}, ${trip.country}`,
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

  return <ShareTripView trip={data.trip} items={data.items} />
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// POST /api/trips/share — generate a share slug for a trip
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tripId } = await req.json()
  if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

  // Check trip belongs to user
  const { data: trip } = await supabase
    .from('trips')
    .select('id, share_slug, destination')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  // If already has a slug, return it
  if (trip.share_slug) {
    return NextResponse.json({ slug: trip.share_slug, url: `/share/${trip.share_slug}` })
  }

  // Generate a short, readable slug
  const slug = generateSlug(trip.destination)

  // Use service role to update (bypasses RLS for share_slug uniqueness)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await admin
    .from('trips')
    .update({ share_slug: slug })
    .eq('id', tripId)

  if (error) {
    // Slug collision — try with random suffix
    const retrySlug = `${slug}-${Math.random().toString(36).slice(2, 5)}`
    const { error: retryError } = await admin
      .from('trips')
      .update({ share_slug: retrySlug })
      .eq('id', tripId)

    if (retryError) return NextResponse.json({ error: retryError.message }, { status: 500 })
    return NextResponse.json({ slug: retrySlug, url: `/share/${retrySlug}` })
  }

  return NextResponse.json({ slug, url: `/share/${slug}` })
}

function generateSlug(destination: string): string {
  const clean = destination.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const rand = Math.random().toString(36).slice(2, 6)
  return `${clean}-${rand}`
}

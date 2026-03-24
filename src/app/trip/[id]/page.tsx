import { redirect } from 'next/navigation'

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/m/board/${id}`)
}

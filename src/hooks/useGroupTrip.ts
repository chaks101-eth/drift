'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'

// ─── Polls ────────────────────────────────────────────────────
export interface PollOption {
  name: string
  detail: string
  price: string
  votes: string[]
}

export interface Poll {
  itemId: string
  itemName: string
  options: PollOption[]
  createdBy: string
  status: 'open' | 'closed'
}

export function usePolls(tripId: string | undefined) {
  const [polls, setPolls] = useState<Poll[]>([])
  const token = useTripStore((s) => s.token)
  const userId = useTripStore((s) => s.userId)

  useEffect(() => {
    if (!tripId) return

    const fetchPolls = () => {
      fetch(`/api/trips/${tripId}/polls`)
        .then(r => r.json())
        .then(data => { if (data.polls) setPolls(data.polls) })
        .catch(() => {})
    }
    fetchPolls()

    // Realtime: re-fetch polls when any itinerary item is updated (poll votes, new polls)
    const channel = supabase
      .channel(`polls:${tripId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'itinerary_items', filter: `trip_id=eq.${tripId}` }, () => {
        fetchPolls()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId])

  const createPoll = useCallback(async (itemId: string) => {
    if (!tripId || !token) return
    try {
      const res = await fetch(`/api/trips/${tripId}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId }),
      })
      const data = await res.json()
      if (data.poll) setPolls(prev => [...prev, data.poll])
    } catch {}
  }, [tripId, token])

  const vote = useCallback(async (itemId: string, optionIndex: number) => {
    if (!tripId || !token || !userId) return
    // Optimistic
    setPolls(prev => prev.map(p => {
      if (p.itemId !== itemId) return p
      const opts = p.options.map((o, i) => ({
        ...o,
        votes: o.votes.filter(v => v !== userId).concat(i === optionIndex ? [userId] : []),
      }))
      return { ...p, options: opts }
    }))
    try {
      await fetch(`/api/trips/${tripId}/polls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, action: 'vote', optionIndex }),
      })
    } catch {}
  }, [tripId, token, userId])

  const applyPoll = useCallback(async (itemId: string) => {
    if (!tripId || !token) return null
    try {
      const res = await fetch(`/api/trips/${tripId}/polls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, action: 'apply' }),
      })
      const data = await res.json()
      if (data.applied) {
        setPolls(prev => prev.map(p => p.itemId === itemId ? { ...p, status: 'closed' as const } : p))
      }
      return data
    } catch { return null }
  }, [tripId, token])

  const closePoll = useCallback(async (itemId: string) => {
    if (!tripId || !token) return
    setPolls(prev => prev.map(p => p.itemId === itemId ? { ...p, status: 'closed' as const } : p))
    try {
      await fetch(`/api/trips/${tripId}/polls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, action: 'close' }),
      })
    } catch {}
  }, [tripId, token])

  return { polls, createPoll, vote, applyPoll, closePoll }
}

// ─── Ready Check ──────────────────────────────────────────────
export interface ReadyCheck {
  active: boolean
  responses: Record<string, 'ready' | 'changes'>
  startedBy?: string
}

export interface GroupNote {
  userId: string
  userName: string
  text: string
  createdAt: string
}

export function useGroupTrip(tripId: string | undefined) {
  const [readyCheck, setReadyCheck] = useState<ReadyCheck | null>(null)
  const [notes, setNotes] = useState<GroupNote[]>([])
  const token = useTripStore((s) => s.token)

  // Fetch group state + subscribe to realtime
  useEffect(() => {
    if (!tripId) return

    const fetchGroup = () => {
      fetch(`/api/trips/${tripId}/group`)
        .then(r => r.json())
        .then(data => {
          if (data.group?.readyCheck) setReadyCheck(data.group.readyCheck)
          if (data.group?.notes) setNotes(data.group.notes)
        })
        .catch(() => {})
    }
    fetchGroup()

    // Realtime: re-fetch when trips table is updated (notes, ready check stored in metadata)
    const channel = supabase
      .channel(`group:${tripId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, () => {
        fetchGroup()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId])

  const startReadyCheck = useCallback(async () => {
    if (!tripId || !token) return
    try {
      const res = await fetch(`/api/trips/${tripId}/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'start_ready_check' }),
      })
      const data = await res.json()
      if (data.group?.readyCheck) setReadyCheck(data.group.readyCheck)
    } catch {}
  }, [tripId, token])

  const respondReady = useCallback(async (response: 'ready' | 'changes') => {
    if (!tripId || !token) return
    try {
      const res = await fetch(`/api/trips/${tripId}/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'respond_ready', response }),
      })
      const data = await res.json()
      if (data.group?.readyCheck) setReadyCheck(data.group.readyCheck)
    } catch {}
  }, [tripId, token])

  const addNote = useCallback(async (text: string) => {
    if (!tripId || !token || !text.trim()) return
    try {
      const res = await fetch(`/api/trips/${tripId}/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'add_note', text: text.trim() }),
      })
      const data = await res.json()
      if (data.group?.notes) setNotes(data.group.notes)
    } catch {}
  }, [tripId, token])

  return { readyCheck, notes, startReadyCheck, respondReady, addNote }
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTripStore } from '@/stores/trip-store'

// ─── Reactions ────────────────────────────────────────────────
interface ReactionMap {
  [itemId: string]: { count: number; reacted: boolean }
}

export function useReactions(tripId: string | undefined) {
  const [reactions, setReactions] = useState<ReactionMap>({})
  const token = useTripStore((s) => s.token)

  // Fetch reactions on mount
  useEffect(() => {
    if (!tripId) return
    const userId = useTripStore.getState().userId
    fetch(`/api/trips/${tripId}/reactions`, {
      headers: userId ? { 'x-user-id': userId } : {},
    })
      .then(r => r.json())
      .then(data => { if (data.reactions) setReactions(data.reactions) })
      .catch(() => {})
  }, [tripId])

  const toggleReaction = useCallback(async (itemId: string) => {
    if (!tripId || !token) return

    // Optimistic update
    setReactions(prev => {
      const current = prev[itemId] || { count: 0, reacted: false }
      return {
        ...prev,
        [itemId]: {
          count: current.reacted ? current.count - 1 : current.count + 1,
          reacted: !current.reacted,
        },
      }
    })

    try {
      const res = await fetch(`/api/trips/${tripId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId }),
      })
      if (!res.ok) {
        // Revert on error
        setReactions(prev => {
          const current = prev[itemId] || { count: 0, reacted: false }
          return {
            ...prev,
            [itemId]: {
              count: current.reacted ? current.count - 1 : current.count + 1,
              reacted: !current.reacted,
            },
          }
        })
      }
    } catch {
      // Revert silently
    }
  }, [tripId, token])

  return { reactions, toggleReaction }
}

// ─── Comments ─────────────────────────────────────────────────
export interface Comment {
  id: string
  item_id: string
  user_id: string
  text: string
  user_name: string
  user_avatar: string | null
  created_at: string
}

export function useComments(tripId: string | undefined, itemId: string | undefined) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading] = useState(false)
  const token = useTripStore((s) => s.token)

  // Fetch comments for a specific item
  useEffect(() => {
    if (!tripId || !itemId) return
    let cancelled = false
    fetch(`/api/trips/${tripId}/comments?itemId=${itemId}`)
      .then(r => r.json())
      .then(data => { if (!cancelled && data.comments) setComments(data.comments) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tripId, itemId])

  const addComment = useCallback(async (text: string) => {
    if (!tripId || !itemId || !token || !text.trim()) return null

    try {
      const res = await fetch(`/api/trips/${tripId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, text }),
      })
      const data = await res.json()
      if (data.comment) {
        setComments(prev => [...prev, data.comment])
        return data.comment
      }
    } catch {}
    return null
  }, [tripId, itemId, token])

  const deleteComment = useCallback(async (commentId: string) => {
    if (!tripId || !token) return

    setComments(prev => prev.filter(c => c.id !== commentId))

    try {
      await fetch(`/api/trips/${tripId}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commentId }),
      })
    } catch {
      // Silently fail — comment already removed from UI
    }
  }, [tripId, token])

  return { comments, loading, addComment, deleteComment }
}

// ─── Collaborators ────────────────────────────────────────────
export interface Collaborator {
  id: string
  user_id: string | null
  email: string | null
  role: string
  accepted_at: string | null
  created_at: string
}

export function useCollaborators(tripId: string | undefined) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const token = useTripStore((s) => s.token)

  useEffect(() => {
    if (!tripId || !token) return
    fetch(`/api/trips/${tripId}/collaborators`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { if (data.collaborators) setCollaborators(data.collaborators) })
      .catch(() => {})
  }, [tripId, token])

  const invite = useCallback(async (email?: string, role = 'editor'): Promise<string | null> => {
    if (!tripId || !token) return null

    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (data.collaborator) {
        setCollaborators(prev => [...prev, data.collaborator])
        return data.inviteLink || null
      }
      return null
    } catch {
      return null
    }
  }, [tripId, token])

  const remove = useCallback(async (collaboratorId: string) => {
    if (!tripId || !token) return

    setCollaborators(prev => prev.filter(c => c.id !== collaboratorId))

    try {
      await fetch(`/api/trips/${tripId}/collaborators`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ collaboratorId }),
      })
    } catch {}
  }, [tripId, token])

  return { collaborators, invite, remove }
}

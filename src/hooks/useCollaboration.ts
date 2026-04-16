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

  // Fetch reactions on mount + poll every 5s
  useEffect(() => {
    if (!tripId) return
    const userId = useTripStore.getState().userId

    const fetchReactions = () => {
      fetch(`/api/trips/${tripId}/reactions`, {
        headers: userId ? { 'x-user-id': userId } : {},
      })
        .then(r => r.json())
        .then(data => { if (data.reactions) setReactions(data.reactions) })
        .catch(() => {})
    }
    fetchReactions()

    const interval = setInterval(fetchReactions, 5000)
    return () => clearInterval(interval)
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

  // Fetch comments
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

// ─── Suggestions ──────────────────────────────────────────────
export function useSuggestions(tripId: string | undefined) {
  const [suggestions, setSuggestions] = useState<Array<{
    id: string; name: string; category: string; detail: string;
    suggested_name: string; created_at: string
  }>>([])
  const token = useTripStore((s) => s.token)

  useEffect(() => {
    if (!tripId) return
    fetch(`/api/trips/${tripId}/suggest`)
      .then(r => r.json())
      .then(data => { if (data.suggestions) setSuggestions(data.suggestions) })
      .catch(() => {})
  }, [tripId])

  const suggest = useCallback(async (name: string, category = 'activity', detail = '') => {
    if (!tripId || !token || !name.trim()) return
    try {
      const res = await fetch(`/api/trips/${tripId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, category, detail }),
      })
      const data = await res.json()
      if (data.suggestion) setSuggestions(prev => [data.suggestion, ...prev])
    } catch {}
  }, [tripId, token])

  const handleSuggestion = useCallback(async (itemId: string, action: 'accept' | 'dismiss') => {
    if (!tripId || !token) return
    setSuggestions(prev => prev.filter(s => s.id !== itemId))
    try {
      await fetch(`/api/trips/${tripId}/suggest`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, action }),
      })
    } catch {}
  }, [tripId, token])

  return { suggestions, suggest, handleSuggestion }
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
    const fetchCollaborators = () => {
      fetch(`/api/trips/${tripId}/collaborators`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => { if (data.collaborators) setCollaborators(data.collaborators) })
        .catch(() => {})
    }
    fetchCollaborators()
    // Poll every 10s so owners see new members join
    const interval = setInterval(fetchCollaborators, 10000)
    return () => clearInterval(interval)
  }, [tripId, token])

  // Returns the trip's share URL — used for link-based invites (preferred).
  // Lazily creates a share_slug if the trip doesn't have one yet.
  const getShareLink = useCallback(async (): Promise<string | null> => {
    if (!tripId || !token) return null
    try {
      const res = await fetch('/api/trips/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tripId }),
      })
      const data = await res.json()
      if (data.url) return `${window.location.origin}${data.url}`
      return null
    } catch {
      return null
    }
  }, [tripId, token])

  // Deprecated email invite path — kept for desktop backwards-compat.
  // Prefer getShareLink() for new code.
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

  // Authed user joins an existing trip they've been shared to.
  const join = useCallback(async (): Promise<{ status: string } | null> => {
    if (!tripId || !token) return null
    try {
      const res = await fetch(`/api/trips/${tripId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      return await res.json()
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

  return { collaborators, invite, getShareLink, join, remove }
}

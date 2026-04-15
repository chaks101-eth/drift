'use client'

import { useState, useMemo } from 'react'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'
import { useCollaborators, type Collaborator } from '@/hooks/useCollaboration'
import { useGroupTrip, usePolls, type ReadyCheck, type GroupNote, type Poll } from '@/hooks/useGroupTrip'

interface Props {
  open: boolean
  onClose: () => void
  tripId: string
}

export default function GroupPanel({ open, onClose, tripId }: Props) {
  const token = useTripStore((s) => s.token)
  const userEmail = useTripStore((s) => s.userEmail)

  // Get current user's display name
  const [ownerName, setOwnerName] = useState('You')
  useMemo(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name = (session.user.user_metadata?.full_name as string) || (session.user.user_metadata?.name as string) || session.user.email?.split('@')[0] || 'You'
        setOwnerName(name)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const { collaborators, invite } = useCollaborators(tripId)
  const { readyCheck, notes, startReadyCheck, respondReady, addNote } = useGroupTrip(tripId)
  const { polls } = usePolls(tripId)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')

  const handleInvite = async () => {
    if (!inviteEmail.trim() && !inviteLink) {
      // Generate link-only invite
      setInviteLoading(true)
      const link = await invite(undefined, 'editor')
      if (link) {
        setInviteLink(link)
        navigator.clipboard.writeText(link)
      }
      setInviteLoading(false)
      return
    }

    if (inviteEmail.includes('@')) {
      setInviteLoading(true)
      const link = await invite(inviteEmail, 'editor')
      if (link) {
        setInviteLink(link)
        navigator.clipboard.writeText(link)
        setInviteEmail('')
      }
      setInviteLoading(false)
    }
  }

  const readyCount = readyCheck ? Object.values(readyCheck.responses).filter(r => r === 'ready').length : 0
  const totalPeople = collaborators.length + 1 // +1 for owner
  const openPolls = polls.filter(p => p.status === 'open')

  return (
    <div className={`fixed right-0 top-0 bottom-0 z-[200] flex w-[380px] flex-col border-l border-white/[0.04] bg-drift-bg/95 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center -space-x-1.5">
            {collaborators.slice(0, 3).map((c, i) => (
              <div key={c.id} className="h-7 w-7 rounded-full bg-drift-gold/15 border-2 border-drift-bg flex items-center justify-center text-[9px] font-bold text-drift-gold" style={{ zIndex: 3 - i }}>
                {c.email?.[0]?.toUpperCase() || '?'}
              </div>
            ))}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-drift-text">Group</div>
            <div className="text-[9px] text-drift-text3">{totalPeople} traveler{totalPeople !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/[0.04] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">

        {/* ─── Invite section (Google Workspace style) ─── */}
        <div className="px-6 py-5 border-b border-white/[0.04]">
          <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-3">Add people</div>
          <div className="flex gap-2 mb-3">
            <input
              value={inviteEmail}
              onChange={e => { setInviteEmail(e.target.value); setInviteLink(null) }}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              placeholder="Email or generate link"
              className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12px] text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none"
            />
            <button
              onClick={handleInvite}
              disabled={inviteLoading}
              className="shrink-0 rounded-lg bg-drift-gold px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-drift-bg disabled:opacity-50 hover:-translate-y-0.5 transition-all"
            >
              {inviteLoading ? '…' : inviteEmail.includes('@') ? 'Invite' : 'Get link'}
            </button>
          </div>
          {inviteLink && (
            <div className="flex items-center gap-2 rounded-lg bg-drift-gold/[0.06] border border-drift-gold/15 px-3 py-2 text-[10px] text-drift-gold animate-[fadeUp_0.3s_ease]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              Link copied to clipboard
            </div>
          )}
        </div>

        {/* ─── Collaborator list ─── */}
        <div className="px-6 py-5 border-b border-white/[0.04]">
          <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-3">Travelers</div>
          <div className="space-y-3">
            {/* Owner (you) */}
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-drift-gold/20 flex items-center justify-center text-[10px] font-bold text-drift-gold">
                {ownerName[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-[12px] font-medium text-drift-text">{ownerName}</div>
                <div className="text-[9px] text-drift-text3">Owner · You</div>
              </div>
              {readyCheck?.active && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </div>

            {/* Collaborators */}
            {collaborators.map(c => {
              const displayName = c.email?.split('@')[0] || 'Invited'
              const initial = c.email?.[0]?.toUpperCase() || '?'
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    c.accepted_at ? 'bg-drift-gold/10 text-drift-gold' : 'bg-white/[0.06] text-drift-text3'
                  }`}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-drift-text truncate">
                      {c.email || 'Invited via link'}
                    </div>
                    <div className="text-[9px] text-drift-text3">
                      {c.accepted_at ? `${c.role} · Joined` : 'Pending invite…'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {readyCheck?.responses[c.user_id || ''] && (
                      readyCheck.responses[c.user_id || ''] === 'ready'
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                        : <span className="h-1.5 w-1.5 rounded-full bg-drift-text3" />
                    )}
                    {!c.accepted_at && (
                      <span className="h-1.5 w-1.5 rounded-full bg-drift-gold " />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── Ready check ─── */}
        <div className="px-6 py-5 border-b border-white/[0.04]">
          <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-3">Ready check</div>
          {!readyCheck?.active ? (
            <button
              onClick={startReadyCheck}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-drift-gold/25 bg-drift-gold/[0.04] py-3 text-[11px] font-semibold text-drift-gold hover:bg-drift-gold/[0.08] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              Check if everyone&apos;s ready
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-[12px] text-drift-text">
                  <span className="font-semibold text-drift-gold tabular-nums">{readyCount}</span>
                  <span className="text-drift-text3"> / {totalPeople} ready</span>
                </div>
                <div className="h-1.5 flex-1 mx-4 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full bg-drift-gold rounded-full transition-all" style={{ width: `${(readyCount / totalPeople) * 100}%` }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => respondReady('ready')}
                  className="flex-1 rounded-xl bg-drift-gold/10 py-2.5 text-[11px] font-semibold text-drift-gold hover:bg-drift-gold/20 transition-colors"
                >
                  Ready
                </button>
                <button
                  onClick={() => respondReady('changes')}
                  className="flex-1 rounded-xl bg-white/[0.04] py-2.5 text-[11px] font-semibold text-drift-text2 hover:bg-white/[0.06] transition-colors"
                >
                  Not yet
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Active polls summary ─── */}
        {openPolls.length > 0 && (
          <div className="px-6 py-5 border-b border-white/[0.04]">
            <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-3">
              Active votes · {openPolls.length}
            </div>
            <div className="space-y-2">
              {openPolls.map(p => {
                const totalVotes = p.options.reduce((s, o) => s + o.votes.length, 0)
                const leader = p.options.reduce((a, b) => a.votes.length > b.votes.length ? a : b)
                return (
                  <div key={p.itemId} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-[11px] font-medium text-drift-text mb-1 truncate">{p.itemName}</div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-drift-text3">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                      {totalVotes > 0 && <span className="text-drift-gold truncate ml-2">Leading: {leader.name}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Group notes ─── */}
        <div className="px-6 py-5">
          <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-3">
            Notes {notes.length > 0 && `· ${notes.length}`}
          </div>

          {notes.length > 0 && (
            <div className="space-y-3 mb-4">
              {notes.map((n, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="h-6 w-6 shrink-0 rounded-full bg-drift-gold/10 flex items-center justify-center text-[8px] font-bold text-drift-gold mt-0.5">
                    {n.userName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold text-drift-text">{n.userName}</span>
                      <span className="text-[8px] text-drift-text3">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[12px] text-drift-text2 leading-relaxed">{n.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {notes.length === 0 && (
            <p className="text-[11px] text-drift-text3 mb-4 italic">No notes yet. Leave a message for the group.</p>
          )}
        </div>
      </div>

      {/* Note input — sticky at bottom */}
      <div className="shrink-0 border-t border-white/[0.04] px-6 py-4">
        <div className="flex gap-2">
          <input
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && noteInput.trim()) { addNote(noteInput); setNoteInput('') } }}
            placeholder="Add a note for the group…"
            className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12px] text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none"
          />
          <button
            onClick={() => { if (noteInput.trim()) { addNote(noteInput); setNoteInput('') } }}
            disabled={!noteInput.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-drift-gold text-drift-bg disabled:opacity-30 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

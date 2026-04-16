'use client'

import { useState, useEffect, useRef } from 'react'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'
import { useCollaborators } from '@/hooks/useCollaboration'
import { useGroupTrip, usePolls } from '@/hooks/useGroupTrip'

interface Props {
  open: boolean
  onClose: () => void
  tripId: string
  isOwner: boolean
}

type Tab = 'people' | 'notes' | 'votes'

export default function MobileGroupSheet({ open, onClose, tripId, isOwner }: Props) {
  const userId = useTripStore((s) => s.userId)

  const { collaborators, getShareLink } = useCollaborators(tripId)
  const { readyCheck, notes, startReadyCheck, respondReady, addNote } = useGroupTrip(tripId)
  const { polls, vote, applyPoll, closePoll } = usePolls(tripId)

  const [tab, setTab] = useState<Tab>('people')
  const [ownerName, setOwnerName] = useState('You')
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [noteSending, setNoteSending] = useState(false)
  const notesEndRef = useRef<HTMLDivElement>(null)

  // Get owner's display name
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name = (session.user.user_metadata?.full_name as string) || (session.user.user_metadata?.name as string) || session.user.email?.split('@')[0] || 'You'
        setOwnerName(name)
      }
    })
  }, [])

  // Auto-scroll notes to bottom when new ones arrive
  useEffect(() => {
    if (tab === 'notes' && notesEndRef.current) {
      notesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [notes.length, tab])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleShareLink = async () => {
    if (linkLoading) return
    setLinkLoading(true)
    const link = await getShareLink()
    if (link) {
      const nav = typeof navigator !== 'undefined' ? navigator : null
      const canNativeShare = !!(nav && typeof nav.share === 'function')
      try {
        if (canNativeShare) {
          // Native share sheet on mobile — user can pick WhatsApp, iMessage, etc.
          await nav!.share({ title: 'Join my Drift trip', url: link })
        } else if (nav?.clipboard) {
          await nav.clipboard.writeText(link)
          setLinkCopied(true)
          setTimeout(() => setLinkCopied(false), 2500)
        }
      } catch {
        // User cancelled the share sheet — fall back to clipboard silently
        try {
          if (nav?.clipboard) {
            await nav.clipboard.writeText(link)
            setLinkCopied(true)
            setTimeout(() => setLinkCopied(false), 2500)
          }
        } catch {}
      }
    }
    setLinkLoading(false)
  }

  const handleAddNote = async () => {
    if (!noteInput.trim() || noteSending) return
    setNoteSending(true)
    await addNote(noteInput.trim())
    setNoteInput('')
    setNoteSending(false)
  }

  // Only count collaborators who have actually joined — pending invites don't count yet
  const joinedCollaborators = collaborators.filter(c => c.accepted_at)
  const pendingCollaborators = collaborators.filter(c => !c.accepted_at)
  const totalPeople = joinedCollaborators.length + 1 // +1 for the owner
  const readyCount = readyCheck ? Object.values(readyCheck.responses).filter(r => r === 'ready').length : 0
  const myResponse = readyCheck && userId ? readyCheck.responses[userId] : undefined
  const openPolls = polls.filter(p => p.status === 'open')
  const newNotesCount = notes.length

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[430px] h-[85vh] flex flex-col rounded-t-3xl border-t border-white/[0.06] bg-drift-bg animate-[slideUp_0.3s_var(--ease-smooth)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="shrink-0 pt-2 pb-1 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-white/[0.12]" />
        </div>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex -space-x-1.5 shrink-0">
              {[{ id: 'owner', email: ownerName }, ...joinedCollaborators.slice(0, 2)].map((c, i) => (
                <div
                  key={c.id}
                  className="h-6 w-6 rounded-full bg-drift-gold/15 border-2 border-drift-bg flex items-center justify-center text-[9px] font-bold text-drift-gold"
                  style={{ zIndex: 3 - i }}
                >
                  {c.email?.[0]?.toUpperCase() || '?'}
                </div>
              ))}
            </div>
            <div className="min-w-0">
              <div className="font-serif text-[15px] font-light text-drift-text leading-tight">Group</div>
              <div className="text-[10px] text-drift-text3">{totalPeople} {totalPeople === 1 ? 'person' : 'people'}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-drift-text3 active:bg-white/[0.04] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-white/[0.04]">
          {([
            { key: 'people' as const, label: 'People', count: totalPeople },
            { key: 'notes' as const, label: 'Notes', count: newNotesCount },
            { key: 'votes' as const, label: 'Votes', count: openPolls.length },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-[1.5px] transition-all ${
                tab === t.key
                  ? 'bg-drift-gold/10 text-drift-gold border border-drift-gold/20'
                  : 'text-drift-text3 border border-transparent active:bg-white/[0.02]'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[8px] ${tab === t.key ? 'bg-drift-gold/15' : 'bg-white/[0.05]'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── PEOPLE TAB ─── */}
        {tab === 'people' && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
              {/* Share section — link-based invites only */}
              {isOwner && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-px w-4 bg-drift-gold/40" />
                    <span className="font-mono text-[8px] tracking-[2px] uppercase text-drift-gold/70">Invite friends</span>
                  </div>

                  <button
                    onClick={handleShareLink}
                    disabled={linkLoading}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-drift-gold/20 bg-drift-gold/[0.06] px-4 py-3.5 text-left transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-drift-gold/15">
                        {linkCopied ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5">
                            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-drift-text">
                          {linkCopied ? 'Link copied' : 'Share trip link'}
                        </div>
                        <div className="text-[10px] text-drift-text3 mt-0.5">
                          {linkCopied ? 'Paste it in WhatsApp, iMessage, anywhere' : 'Friends who open it can join the group'}
                        </div>
                      </div>
                    </div>
                    {linkLoading && (
                      <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-drift-gold/30 border-t-drift-gold" />
                    )}
                  </button>
                </div>
              )}

              {/* Travelers list */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-px w-4 bg-drift-gold/40" />
                  <span className="font-mono text-[8px] tracking-[2px] uppercase text-drift-gold/70">Travelers</span>
                  <span className="font-mono text-[8px] tabular-nums text-drift-text3/70">({totalPeople})</span>
                </div>
                <div className="space-y-1.5">
                  {/* Owner */}
                  <div className="flex items-center gap-3 rounded-xl border border-drift-border2 bg-drift-surface px-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-drift-gold/15 text-[11px] font-bold text-drift-gold">
                      {ownerName[0]?.toUpperCase() || 'Y'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-drift-text truncate">{ownerName}</div>
                      <div className="text-[9px] font-mono uppercase tracking-[1px] text-drift-text3">Owner</div>
                    </div>
                  </div>
                  {/* Joined collaborators */}
                  {joinedCollaborators.map(c => (
                    <div key={c.id} className="flex items-center gap-3 rounded-xl border border-drift-border2 bg-drift-surface px-3 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-drift-gold/15 text-[11px] font-bold text-drift-gold">
                        {c.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-drift-text truncate">{c.email || 'Joined'}</div>
                        <div className="text-[9px] font-mono uppercase tracking-[1px] text-[#4ecdc4]">Joined</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending invites — legacy rows from email invites; will be empty for new trips */}
              {pendingCollaborators.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-px w-4 bg-white/[0.08]" />
                    <span className="font-mono text-[8px] tracking-[2px] uppercase text-drift-text3">Pending invites</span>
                  </div>
                  <div className="space-y-1.5">
                    {pendingCollaborators.map(c => (
                      <div key={c.id} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.015] px-3 py-2 opacity-70">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-drift-text3/40 text-[10px] font-bold text-drift-text3">
                          {c.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-drift-text2 truncate">{c.email || 'Invited'}</div>
                          <div className="text-[9px] font-mono uppercase tracking-[1px] text-drift-text3">Not yet joined</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ready check */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-px w-4 bg-drift-gold/40" />
                  <span className="font-mono text-[8px] tracking-[2px] uppercase text-drift-gold/70">Ready check</span>
                </div>

                {!readyCheck?.active && isOwner && (
                  <button
                    onClick={startReadyCheck}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-drift-gold/10 border border-drift-gold/20 px-4 py-3 text-[11px] font-semibold tracking-wider uppercase text-drift-gold active:scale-[0.98] transition-transform"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Check if everyone's ready
                  </button>
                )}

                {readyCheck?.active && (
                  <div className="space-y-3">
                    {/* Progress */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-drift-text2">{readyCount} of {totalPeople} ready</span>
                        <span className="font-mono text-[10px] tabular-nums text-drift-text3">{Math.round((readyCount / totalPeople) * 100)}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-drift-gold to-[#4ecdc4] transition-all duration-500"
                          style={{ width: `${(readyCount / totalPeople) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* My response buttons */}
                    {!myResponse && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => respondReady('ready')}
                          className="rounded-xl bg-[#4ecdc4]/10 border border-[#4ecdc4]/20 px-3 py-2.5 text-[11px] font-semibold text-[#4ecdc4] active:scale-[0.98] transition-transform"
                        >
                          I'm ready
                        </button>
                        <button
                          onClick={() => respondReady('changes')}
                          className="rounded-xl border border-drift-border2 bg-drift-surface px-3 py-2.5 text-[11px] font-semibold text-drift-text3 active:scale-[0.98] transition-transform"
                        >
                          Not yet
                        </button>
                      </div>
                    )}
                    {myResponse && (
                      <div className="rounded-xl border border-drift-border2 bg-drift-surface px-3 py-2.5 text-center">
                        <span className="text-[11px] text-drift-text3">You're marked as </span>
                        <span className={`text-[11px] font-semibold ${myResponse === 'ready' ? 'text-[#4ecdc4]' : 'text-drift-text2'}`}>
                          {myResponse === 'ready' ? 'ready' : 'needing changes'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── NOTES TAB ─── */}
        {tab === 'notes' && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {notes.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center py-8">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-drift-gold/10 border border-drift-gold/15">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div className="font-serif text-[15px] text-drift-text">Group notes</div>
                  <p className="mt-1 max-w-[240px] text-[11px] text-drift-text3 leading-relaxed">
                    Share thoughts, asks, or reminders with your travel group. Visible to everyone.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note, i) => {
                    const isMine = note.userId === userId
                    return (
                      <div key={i} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isMine ? 'bg-drift-gold text-drift-bg' : 'bg-white/[0.08] text-drift-text2'}`}>
                          {note.userName[0]?.toUpperCase() || '?'}
                        </div>
                        <div className={`flex-1 min-w-0 ${isMine ? 'items-end' : ''}`}>
                          <div className={`flex items-center gap-1.5 mb-0.5 ${isMine ? 'justify-end' : ''}`}>
                            <span className="text-[10px] font-medium text-drift-text2">{isMine ? 'You' : note.userName}</span>
                            <span className="font-mono text-[8px] text-drift-text3">
                              {new Date(note.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-snug ${isMine ? 'bg-drift-gold/10 border border-drift-gold/15 text-drift-text rounded-br-md' : 'bg-white/[0.04] border border-white/[0.06] text-drift-text2 rounded-bl-md'}`}>
                            {note.text}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={notesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-white/[0.04] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  placeholder="Leave a note for the group..."
                  maxLength={500}
                  className="flex-1 rounded-full border border-drift-border2 bg-drift-surface px-4 py-2.5 text-[12px] text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none transition-colors"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteInput.trim() || noteSending}
                  aria-label="Send note"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-drift-gold text-drift-bg disabled:opacity-40 active:scale-95 transition-transform"
                >
                  {noteSending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── VOTES TAB ─── */}
        {tab === 'votes' && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {openPolls.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center py-8">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-drift-gold/10 border border-drift-gold/15">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                </div>
                <div className="font-serif text-[15px] text-drift-text">No open votes</div>
                <p className="mt-1 max-w-[260px] text-[11px] text-drift-text3 leading-relaxed">
                  Long-press any item on the board to start a poll — your group can vote on alternatives.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {openPolls.map(poll => {
                  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0)
                  const leadingIdx = poll.options.reduce((maxI, o, i, arr) => o.votes.length > arr[maxI].votes.length ? i : maxI, 0)
                  return (
                    <div key={poll.itemId} className="rounded-2xl border border-drift-border2 bg-drift-surface p-3.5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[8px] tracking-[1.5px] uppercase text-drift-gold/70 mb-0.5">Swap for</div>
                          <div className="font-serif text-[14px] font-light text-drift-text truncate">{poll.itemName}</div>
                        </div>
                        <span className="shrink-0 font-mono text-[9px] text-drift-text3 tabular-nums">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
                      </div>

                      <div className="space-y-2">
                        {poll.options.map((opt, oi) => {
                          const hasVoted = userId ? opt.votes.includes(userId) : false
                          const pct = totalVotes > 0 ? (opt.votes.length / totalVotes) * 100 : 0
                          const isLeading = oi === leadingIdx && opt.votes.length > 0
                          return (
                            <button
                              key={oi}
                              onClick={() => vote(poll.itemId, oi)}
                              className={`relative block w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98] ${
                                hasVoted
                                  ? 'border-drift-gold/40 bg-drift-gold/[0.06]'
                                  : 'border-drift-border2 bg-drift-surface2 active:bg-white/[0.04]'
                              }`}
                            >
                              {/* Progress fill */}
                              <div
                                className="absolute inset-y-0 left-0 bg-drift-gold/[0.06] transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                              <div className="relative flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className={`text-[12px] font-medium truncate ${hasVoted ? 'text-drift-gold' : 'text-drift-text'}`}>
                                    {opt.name}
                                  </div>
                                  {opt.detail && <div className="text-[10px] text-drift-text3 truncate mt-0.5">{opt.detail}</div>}
                                </div>
                                <div className="shrink-0 flex items-center gap-1.5">
                                  {opt.price && <span className="font-mono text-[10px] text-drift-text2 tabular-nums">{opt.price}</span>}
                                  {isLeading && <span className="font-mono text-[8px] tracking-wider uppercase text-[#4ecdc4]">Lead</span>}
                                </div>
                              </div>
                              <div className="relative mt-1.5 flex items-center gap-1.5">
                                <span className={`font-mono text-[9px] tabular-nums ${hasVoted ? 'text-drift-gold/80' : 'text-drift-text3'}`}>
                                  {opt.votes.length} {opt.votes.length === 1 ? 'vote' : 'votes'}
                                </span>
                                {hasVoted && (
                                  <span className="flex items-center gap-1 font-mono text-[8px] tracking-wider uppercase text-drift-gold">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                    Your pick
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      {/* Owner controls */}
                      {isOwner && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => applyPoll(poll.itemId)}
                            disabled={totalVotes === 0}
                            className="flex-1 rounded-xl bg-drift-gold/10 border border-drift-gold/20 px-3 py-2 text-[10px] font-semibold tracking-wider uppercase text-drift-gold active:scale-[0.98] transition-transform disabled:opacity-40"
                          >
                            Apply top pick
                          </button>
                          <button
                            onClick={() => closePoll(poll.itemId)}
                            className="rounded-xl border border-drift-border2 bg-drift-surface px-3 py-2 text-[10px] font-semibold tracking-wider uppercase text-drift-text3 active:scale-[0.98] transition-transform"
                          >
                            Close
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

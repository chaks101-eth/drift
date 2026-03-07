'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Trip, ItineraryItem } from '@/lib/database.types'

// ─── Types ─────────────────────────────────────────────────────
type ItemStatus = 'none' | 'picked' | 'skipped' | 'saved'
type Alt = { name: string; detail: string; price: string; image_url?: string; bookingUrl?: string; trust?: Array<{ type: 'success' | 'gold' | 'warn'; text: string }> }
type ChatMsg = { role: 'user' | 'assistant'; content: string }

// ─── Color helpers ─────────────────────────────────────────────
const categoryColors: Record<string, string> = {
  flight: '#c8a44e',
  hotel: '#4ecdc4',
  activity: '#e8cc6e',
  food: '#f0a500',
  transfer: '#7a7a85',
}

function statusBorder(status: ItemStatus) {
  if (status === 'picked') return 'border-[#4ecdc4]'
  if (status === 'skipped') return 'border-[#e74c3c] opacity-50'
  if (status === 'saved') return 'border-[#c8a44e]'
  return 'border-[rgba(255,255,255,0.08)]'
}

function parsePrice(price: string): number {
  return parseFloat(price.replace(/[^0-9.]/g, '')) || 0
}

// ─── Main Page ─────────────────────────────────────────────────
export default function TripBoardPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [items, setItems] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')

  // UI state
  const [insightDismissed, setInsightDismissed] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null)
  const [showAlts, setShowAlts] = useState(false)
  const [menuItem, setMenuItem] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatContext, setChatContext] = useState<ItineraryItem | null>(null)
  const [activeNav, setActiveNav] = useState<'board' | 'picks' | 'alerts' | 'flights' | 'trip'>('board')

  // Regeneration state
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set())
  const [regenerating, setRegenerating] = useState(false)
  const [showVibeRemix, setShowVibeRemix] = useState(false)
  const [remixVibes, setRemixVibes] = useState<string[]>([])
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null)

  // Fetch trip and items
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)

      const { data: tripData } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .single()
      if (!tripData) { router.push('/'); return }
      setTrip(tripData as Trip)

      const { data: itemData } = await supabase
        .from('itinerary_items')
        .select('*')
        .eq('trip_id', id)
        .order('position')
      setItems((itemData || []) as ItineraryItem[])
      setLoading(false)
    }
    load()
  }, [id, router])

  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  // Update item status + track interaction
  const updateStatus = useCallback(async (itemId: string, status: ItemStatus) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status } : i))
    await supabase.from('itinerary_items').update({ status }).eq('id', itemId)

    // Track the interaction
    if (token && trip && (status === 'picked' || status === 'skipped' || status === 'saved')) {
      const item = items.find(i => i.id === itemId)
      if (item) {
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            itemType: item.category,
            itemName: item.name,
            destination: trip.destination,
            action: status,
          }),
        }).catch(() => {}) // fire and forget
      }
    }
  }, [token, trip, items])

  // Share trip
  async function handleShare() {
    if (shareUrl) { navigator.clipboard.writeText(window.location.origin + shareUrl); return }
    setSharing(true)
    try {
      const res = await fetch('/api/trips/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tripId: id }),
      })
      const data = await res.json()
      if (data.url) {
        setShareUrl(data.url)
        navigator.clipboard.writeText(window.location.origin + data.url)
      }
    } catch {}
    setSharing(false)
  }

  // Swap an item on the board (used by chat swap-inline and alternatives)
  const swapItem = useCallback(async (itemId: string, newData: { name: string; detail: string; price: string; image_url?: string; bookingUrl?: string }) => {
    // Optimistic update
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      name: newData.name,
      detail: newData.detail,
      price: newData.price,
      image_url: newData.image_url || i.image_url,
      metadata: { ...(i.metadata as Record<string, unknown> || {}), bookingUrl: newData.bookingUrl },
    } : i))
    // Persist
    await supabase.from('itinerary_items').update({
      name: newData.name,
      detail: newData.detail,
      price: newData.price,
      ...(newData.image_url ? { image_url: newData.image_url } : {}),
    }).eq('id', itemId)
  }, [])

  // Send chat message
  async function sendChat(text?: string) {
    const msg = text || chatInput.trim()
    if (!msg) return
    const newMessages: ChatMsg[] = [...chatMessages, { role: 'user', content: msg }]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: newMessages,
          tripId: id,
          contextItemId: chatContext?.id || null,
        }),
      })
      const data = await res.json()
      if (data.text) {
        setChatMessages([...newMessages, { role: 'assistant', content: data.text }])
      }
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, I had trouble responding. Try again?' }])
    }
    setChatLoading(false)
  }

  // Surprise Me — pick random vibes and open destinations
  function surpriseMe() {
    const allVibes = ['beach', 'culture', 'foodie', 'adventure', 'party', 'spiritual', 'romance', 'city', 'solo', 'winter']
    const shuffled = allVibes.sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, 3)
    router.push(`/vibes?surprise=${picked.join(',')}`)
  }

  // Lock/unlock items
  const toggleLock = useCallback((itemId: string) => {
    setLockedIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  // Regenerate itinerary
  const regenerate = useCallback(async (mode: 'full' | 'budget' | 'vibes' | 'day', opts?: { budget?: string; vibes?: string[]; dayIndex?: number }) => {
    if (!token || !trip) return
    setRegenerating(true)
    if (mode === 'day' && opts?.dayIndex !== undefined) setRegeneratingDay(opts.dayIndex)

    try {
      const res = await fetch('/api/ai/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tripId: id,
          mode,
          lockedItemIds: Array.from(lockedIds),
          ...opts,
        }),
      })
      const data = await res.json()
      if (data.items) {
        setItems(data.items as ItineraryItem[])
        // Update trip if budget/vibes changed
        if (mode === 'budget' && opts?.budget) setTrip(prev => prev ? { ...prev, budget: opts.budget! } : prev)
        if (mode === 'vibes' && opts?.vibes) setTrip(prev => prev ? { ...prev, vibes: opts.vibes! } : prev)
      } else if (data.error) {
        console.error('Regeneration failed:', data.error)
      }
    } catch (e) {
      console.error('Regeneration error:', e)
    }
    setRegenerating(false)
    setRegeneratingDay(null)
    setShowVibeRemix(false)
  }, [token, trip, id, lockedIds])

  // Filtered items for nav views
  const pickedItems = items.filter(i => i.status === 'picked' && i.category !== 'day' && i.category !== 'transfer')
  const flightItems = items.filter(i => i.category === 'flight')

  // Group items by day
  const days: { label: string; detail: string; items: ItineraryItem[] }[] = []
  let currentDay: { label: string; detail: string; items: ItineraryItem[] } | null = null
  for (const item of items) {
    if (item.category === 'day') {
      if (currentDay) days.push(currentDay)
      currentDay = { label: item.name, detail: item.detail, items: [] }
    } else if (currentDay) {
      currentDay.items.push(item)
    } else {
      // Items before first day marker
      if (!currentDay) currentDay = { label: 'Arrival', detail: '', items: [] }
      currentDay.items.push(item)
    }
  }
  if (currentDay) days.push(currentDay)

  // Cost summary
  const costs = items.reduce((acc, i) => {
    if (i.category === 'flight') acc.flights += parsePrice(i.price)
    else if (i.category === 'hotel') acc.hotels += parsePrice(i.price)
    else if (i.category === 'activity') acc.activities += parsePrice(i.price)
    else if (i.category === 'food') acc.food += parsePrice(i.price)
    return acc
  }, { flights: 0, hotels: 0, activities: 0, food: 0 })
  const total = costs.flights + costs.hotels + costs.activities + costs.food

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center flex-col gap-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center animate-[load-breathe_2s_ease-in-out_infinite]"
          style={{ background: 'radial-gradient(circle, rgba(200,164,78,0.2), transparent 70%)' }}>
          <div className="w-8 h-8 rounded-full border-[1.5px] border-[#c8a44e] border-t-transparent animate-[load-spin_1s_linear_infinite]" />
        </div>
        <div className="font-serif text-xl text-[#c8a44e]">Loading your trip...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* ─── Top Bar (Board Header) ─────────────── */}
      <div className="sticky top-0 z-30 bg-[#08080c]/95 backdrop-blur-sm border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between px-8 py-3 max-md:px-4 max-md:flex-col max-md:items-start max-md:gap-2">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-[#7a7a85] hover:text-[#f0efe8]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </button>
            <div>
              <h1 className="font-serif text-2xl max-md:text-[22px]">{trip?.destination}, <span className="text-[#7a7a85]">{trip?.country}</span></h1>
              <p className="text-xs text-[#7a7a85] max-md:text-[11px]">{trip?.start_date} — {trip?.end_date} &middot; {trip?.travelers} travelers &middot; {days.length} days</p>
            </div>
          </div>
          <div className="flex items-center gap-2 max-md:w-full max-md:overflow-x-auto max-md:gap-1.5 max-md:pb-0.5">
            {/* Budget Toggle */}
            <div className="flex items-center gap-1 mr-3">
              {(['budget', 'mid', 'luxury'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => { if (trip?.budget !== level) regenerate('budget', { budget: level }) }}
                  disabled={regenerating}
                  className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
                    trip?.budget === level
                      ? 'bg-[#c8a44e] text-[#08080c]'
                      : 'text-[#7a7a85] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(200,164,78,0.3)] hover:text-[#c8a44e]'
                  }`}
                >
                  {level === 'budget' ? '$' : level === 'mid' ? '$$' : '$$$'}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setRemixVibes(trip?.vibes || []); setShowVibeRemix(true) }}
              disabled={regenerating}
              className="px-3 py-1.5 rounded-full text-[10px] text-[#7a7a85] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(200,164,78,0.3)] hover:text-[#c8a44e] transition-all disabled:opacity-50"
            >
              Remix Vibes
            </button>
            {lockedIds.size > 0 && (
              <button
                onClick={() => regenerate('full')}
                disabled={regenerating}
                className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-[#c8a44e] to-[#a88a3e] text-[#08080c] hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {regenerating ? 'Regenerating...' : `Regenerate (${items.length - lockedIds.size - items.filter(i => i.category === 'flight').length} items)`}
              </button>
            )}
            <button
              onClick={handleShare}
              disabled={sharing}
              className="px-4 py-1.5 rounded-full text-[10px] font-semibold border border-[rgba(255,255,255,0.08)] text-[#f0efe8] hover:border-[#c8a44e] hover:text-[#c8a44e] transition-all disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1 -mt-0.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              {shareUrl ? 'Copied!' : sharing ? '...' : 'Share'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Cost Summary Bar ────────────────────── */}
      <div className="px-8 pt-4 max-md:px-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] max-md:overflow-x-auto max-md:p-2.5">
          <div className="flex items-center gap-6 max-md:gap-3.5 flex-shrink-0">
            {[
              { label: 'Flights', val: costs.flights, color: '#c8a44e' },
              { label: 'Hotels', val: costs.hotels, color: '#4ecdc4' },
              { label: 'Activities', val: costs.activities, color: '#e8cc6e' },
              { label: 'Food', val: costs.food, color: '#f0a500' },
            ].map(c => (
              <div key={c.label} className="flex flex-col items-center">
                <span className="text-[9px] text-[#4a4a55] uppercase tracking-wider">{c.label}</span>
                <span className="text-base font-light" style={{ color: c.color }}>${c.val.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center pl-6 border-l border-[rgba(255,255,255,0.08)]">
            <span className="text-[9px] text-[#4a4a55] uppercase tracking-wider">Total ({trip?.travelers} pax)</span>
            <span className="text-xl font-light text-[#c8a44e]">${total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ─── AI Insight Bar ─────────────────────── */}
      {!insightDismissed && items.length > 0 && (
        <div className="mx-6 mt-6 p-4 rounded-xl border border-[rgba(200,164,78,0.15)] bg-[rgba(200,164,78,0.04)]">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#c8a44e] to-[#e8cc6e] flex items-center justify-center text-[10px] font-bold text-[#08080c]">D</span>
              <span className="text-sm font-medium text-[#c8a44e]">Here&apos;s what I considered building this itinerary</span>
            </div>
            <button onClick={() => setInsightDismissed(true)} className="text-[#7a7a85] hover:text-[#f0efe8] text-sm">&times;</button>
          </div>
          <p className="text-[12px] text-[#7a7a85] leading-relaxed mb-3">
            I optimized for your vibes ({trip?.vibes?.slice(0, 3).join(', ')}), balanced timing to avoid crowds, and matched picks to your {trip?.budget} budget. Each suggestion has a reason — tap any card to see why.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { text: 'Crowd-optimized timing', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
              { text: 'Route-efficient ordering', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
              { text: 'Budget-matched picks', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
              { text: 'Vibe-aligned activities', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
            ].map(pill => (
              <span key={pill.text} className="px-2.5 py-1 rounded-full text-[10px] text-[#c8a44e] border border-[rgba(200,164,78,0.2)] bg-[rgba(200,164,78,0.06)] flex items-center gap-1.5">
                {pill.icon} {pill.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Flowchart Board ────────────────────── */}
      <div className="overflow-x-auto px-6 py-8 max-md:px-4 max-md:py-4">
        <div className="min-w-max">
          {days.map((day, dayIdx) => (
            <div key={dayIdx} className="mb-2">
              {/* Day connector line with label */}
              {dayIdx > 0 && (
                <div className="flex items-center gap-2 pl-[18px] py-2">
                  <div className="w-0.5 h-8 bg-[rgba(255,255,255,0.08)]" />
                  <span className="text-[9px] text-[#4a4a55] uppercase tracking-wider">Next day</span>
                </div>
              )}

              {/* Day header */}
              <div className="flex items-center gap-3 mb-4 pl-1 group/day max-md:gap-2 max-md:mb-2.5">
                <div className="w-3 h-3 rounded-full bg-[#c8a44e] shadow-[0_0_12px_rgba(200,164,78,0.4)] max-md:w-2.5 max-md:h-2.5" />
                <span className="font-serif text-lg text-[#f0efe8] max-md:text-[11px] max-md:tracking-[2px] max-md:uppercase max-md:font-semibold max-md:font-sans">{day.label}</span>
                <span className="text-xs text-[#4a4a55] max-md:text-[10px]">{day.detail}</span>
                <button
                  onClick={() => regenerate('day', { dayIndex: dayIdx })}
                  disabled={regenerating}
                  className="opacity-0 group-hover/day:opacity-100 ml-2 px-2.5 py-1 rounded-full text-[9px] text-[#7a7a85] border border-[rgba(255,255,255,0.08)] hover:border-[#c8a44e] hover:text-[#c8a44e] transition-all disabled:opacity-50"
                >
                  {regeneratingDay === dayIdx ? 'Regenerating...' : 'Regenerate Day'}
                </button>
              </div>

              {/* Horizontal lane */}
              <div className="flex items-start gap-0 pl-8">
                {day.items.map((item, itemIdx) => (
                  <div key={item.id} className="flex items-start">
                    {/* Arrow connector with Add Stop button */}
                    {itemIdx > 0 && (
                      <div className="flex flex-col items-center self-center mx-1 group/conn">
                        <div className="flex items-center">
                          <div className="w-8 h-[1px] bg-[rgba(255,255,255,0.1)]" />
                          {item.category === 'transfer' ? (
                            <div className="px-2 py-0.5 text-[9px] text-[#7a7a85] whitespace-nowrap flex items-center gap-1">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h2l2-4h6l2 4h2"/><circle cx="7.5" cy="17" r="2.5"/><circle cx="16.5" cy="17" r="2.5"/><path d="M14 7h2l3 5"/><path d="M5 12h9"/></svg>
                              {(item.metadata as Record<string, string>)?.travel || item.detail}
                            </div>
                          ) : (
                            <div className="w-2 h-[1px] bg-[rgba(255,255,255,0.1)]" />
                          )}
                          <div className="w-8 h-[1px] bg-[rgba(255,255,255,0.1)]" />
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setChatContext(null); setChatOpen(true); setChatInput(`Add a stop between items here`) }}
                          className="w-5 h-5 rounded-full border border-dashed border-[rgba(255,255,255,0.12)] text-[#7a7a85] text-sm flex items-center justify-center mt-1 opacity-0 group-hover/conn:opacity-100 transition-opacity hover:border-[#c8a44e] hover:text-[#c8a44e] hover:bg-[rgba(200,164,78,0.08)] hover:border-solid fc-add-touch"
                          title="Add a stop"
                        >+</button>
                      </div>
                    )}

                    {/* Skip rendering transfer as a full node — it's shown in the connector */}
                    {item.category !== 'transfer' && (
                      <FlowNode
                        item={item}
                        onSelect={() => setSelectedItem(item)}
                        onStatusChange={updateStatus}
                        menuOpen={menuItem === item.id}
                        onMenuToggle={() => setMenuItem(menuItem === item.id ? null : item.id)}
                        locked={lockedIds.has(item.id)}
                        onToggleLock={() => toggleLock(item.id)}
                        onAskAI={() => {
                          setChatContext(item)
                          setChatOpen(true)
                        }}
                        onAlternatives={() => {
                          setSelectedItem(item)
                          setShowAlts(true)
                        }}
                        onPriceAlert={() => {
                          setChatContext(item)
                          setChatOpen(true)
                          setChatInput(`Set a price alert for ${item.name}`)
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Bottom Sheet: Item Detail ──────────── */}
      {selectedItem && !showAlts && (
        <BottomSheet onClose={() => setSelectedItem(null)}>
          <ItemDetail
            item={selectedItem}
            onPick={() => { updateStatus(selectedItem.id, selectedItem.status === 'picked' ? 'none' : 'picked'); setSelectedItem(null) }}
            onAlternatives={() => setShowAlts(true)}
            onAskAI={() => { setChatContext(selectedItem); setChatOpen(true); setSelectedItem(null) }}
          />
        </BottomSheet>
      )}

      {/* ─── Bottom Sheet: Alternatives ─────────── */}
      {selectedItem && showAlts && (
        <BottomSheet onClose={() => { setShowAlts(false); setSelectedItem(null) }}>
          <AlternativesPanel item={selectedItem} onSwap={(newData) => { swapItem(selectedItem.id, newData); setShowAlts(false); setSelectedItem(null) }} />
        </BottomSheet>
      )}

      {/* ─── Chat FAB + Panel ───────────────────── */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-[82px] right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-[#c8a44e] to-[#e8cc6e] flex items-center justify-center shadow-[0_4px_24px_rgba(200,164,78,0.4)] hover:scale-105 transition-transform max-md:right-3.5 max-md:w-[46px] max-md:h-[46px]"
        >
          <svg width="20" height="20" fill="none" stroke="#08080c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>
      )}
      {chatOpen && (
        <ChatPanel
          messages={chatMessages}
          loading={chatLoading}
          input={chatInput}
          contextItem={chatContext}
          onInputChange={setChatInput}
          onSend={sendChat}
          onClose={() => setChatOpen(false)}
          onClearContext={() => setChatContext(null)}
          onSwap={chatContext ? (newData) => { swapItem(chatContext.id, newData) } : undefined}
        />
      )}

      {/* ─── Picks Overlay ────────────────────────── */}
      {activeNav === 'picks' && (
        <BottomSheet onClose={() => setActiveNav('board')}>
          <h2 className="font-serif text-xl mb-1">Your Picks</h2>
          <p className="text-sm text-[#7a7a85] mb-4">{pickedItems.length} items picked</p>
          {pickedItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-[rgba(78,205,196,0.08)] border border-[rgba(78,205,196,0.15)] flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
              <div className="text-sm font-medium text-[#7a7a85] mb-1">Your picks will show up here</div>
              <p className="text-xs text-[#4a4a55] max-w-[260px] mx-auto">Tap the checkmark on any card in your itinerary to save it to your picks.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pickedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(78,205,196,0.15)]">
                  {item.image_url && <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-[11px] text-[#7a7a85]">{item.detail}</div>
                  </div>
                  <div className="text-sm font-light" style={{ color: categoryColors[item.category] || '#7a7a85' }}>{item.price}</div>
                </div>
              ))}
              <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] flex justify-between items-center">
                <span className="text-sm text-[#7a7a85]">Picked total</span>
                <span className="text-lg font-light text-[#4ecdc4]">${pickedItems.reduce((s, i) => s + parsePrice(i.price), 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </BottomSheet>
      )}

      {/* ─── Alerts Overlay ─────────────────────────── */}
      {activeNav === 'alerts' && (
        <BottomSheet onClose={() => setActiveNav('board')}>
          <h2 className="font-serif text-xl mb-1">Price Alerts</h2>
          <p className="text-sm text-[#7a7a85] mb-4">Get notified when prices drop for your picks</p>
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-[rgba(200,164,78,0.08)] border border-[rgba(200,164,78,0.15)] flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div className="text-sm font-medium text-[#7a7a85] mb-1">Price intelligence is ready</div>
            <p className="text-xs text-[#4a4a55] max-w-[280px] mx-auto">Use the 3-dot menu on any flight or hotel to set a price alert. We&apos;ll notify you when prices drop.</p>
          </div>
        </BottomSheet>
      )}

      {/* ─── Flights Overlay ──────────────────────── */}
      {activeNav === 'flights' && (
        <BottomSheet onClose={() => setActiveNav('board')}>
          <h2 className="font-serif text-xl mb-1">Flights</h2>
          <p className="text-sm text-[#7a7a85] mb-4">{flightItems.length} flights in your trip</p>
          {flightItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-[rgba(200,164,78,0.08)] border border-[rgba(200,164,78,0.15)] flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
              </div>
              <div className="text-sm font-medium text-[#7a7a85] mb-1">No flights added yet</div>
              <p className="text-xs text-[#4a4a55] max-w-[260px] mx-auto">Flights will appear here once your itinerary includes them.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flightItems.map(item => {
                const meta = item.metadata as Record<string, unknown> | null
                const dep = meta?.departure as { airport: string; time: string } | undefined
                const arr = meta?.arrival as { airport: string; time: string } | undefined
                const info = (meta?.info as { l: string; v: string }[]) || []
                const duration = info.find(i => i.l === 'Duration')?.v || ''
                const skyscannerUrl = meta?.skyscannerUrl as string | undefined
                return (
                  <div key={item.id} className="p-4 rounded-xl border border-[rgba(200,164,78,0.15)] bg-[rgba(200,164,78,0.04)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-light">{dep?.airport || '?'}</span>
                        <span className="text-[#c8a44e]">&#8594;</span>
                        <span className="text-lg font-light">{arr?.airport || '?'}</span>
                      </div>
                      <span className="text-sm font-light text-[#c8a44e]">{item.price}</span>
                    </div>
                    <div className="text-[11px] text-[#7a7a85]">{item.detail} &middot; {duration}</div>
                    {skyscannerUrl && (
                      <a href={skyscannerUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-3 py-1 rounded text-[10px] font-medium bg-[#4ecdc4] text-[#08080c]">
                        Track on Skyscanner
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </BottomSheet>
      )}

      {/* ─── Trip Summary Overlay ─────────────────── */}
      {activeNav === 'trip' && (
        <BottomSheet onClose={() => setActiveNav('board')}>
          <h2 className="font-serif text-xl mb-1">{trip?.destination}, {trip?.country}</h2>
          <p className="text-sm text-[#7a7a85] mb-4">{trip?.start_date} — {trip?.end_date} &middot; {trip?.travelers} travelers &middot; {trip?.budget}</p>
          <div className="space-y-2 mb-4">
            {[
              { label: 'Flights', val: costs.flights, color: '#c8a44e' },
              { label: 'Hotels', val: costs.hotels, color: '#4ecdc4' },
              { label: 'Activities', val: costs.activities, color: '#e8cc6e' },
              { label: 'Food', val: costs.food, color: '#f0a500' },
            ].map(c => (
              <div key={c.label} className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-sm">{c.label}</span>
                </div>
                <span className="text-sm font-light" style={{ color: c.color }}>${c.val.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm text-[#7a7a85]">Total estimated</span>
            <span className="text-xl font-light text-[#c8a44e]">${total.toLocaleString()}</span>
          </div>
          {trip?.vibes && trip.vibes.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mb-2">Vibes</div>
              <div className="flex flex-wrap gap-1.5">
                {trip.vibes.map(v => (
                  <span key={v} className="px-2.5 py-1 rounded-full text-[11px] text-[#c8a44e] border border-[rgba(200,164,78,0.2)] bg-[rgba(200,164,78,0.06)]">{v}</span>
                ))}
              </div>
            </div>
          )}
          <button onClick={surpriseMe} className="w-full mt-6 py-3 rounded-xl border border-[rgba(255,255,255,0.08)] text-sm text-[#f0efe8] hover:border-[#c8a44e] hover:text-[#c8a44e] transition-colors">
            Surprise Me &#10024;
          </button>
        </BottomSheet>
      )}

      {/* ─── Vibe Remix Modal ──────────────────────── */}
      {showVibeRemix && (
        <BottomSheet onClose={() => setShowVibeRemix(false)}>
          <h2 className="font-serif text-xl mb-1">Remix Your Vibes</h2>
          <p className="text-sm text-[#7a7a85] mb-5">Change your vibes and we&apos;ll regenerate the itinerary. Locked items stay.</p>

          <div className="grid grid-cols-5 gap-2 mb-6">
            {['beach', 'culture', 'foodie', 'adventure', 'party', 'spiritual', 'romance', 'city', 'solo', 'winter'].map(vibe => (
              <button
                key={vibe}
                onClick={() => setRemixVibes(prev => prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe])}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  remixVibes.includes(vibe)
                    ? 'bg-[#c8a44e] text-[#08080c] shadow-[0_0_12px_rgba(200,164,78,0.3)]'
                    : 'bg-[rgba(255,255,255,0.04)] text-[#7a7a85] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(200,164,78,0.3)]'
                }`}
              >
                {vibe}
              </button>
            ))}
          </div>

          {/* Show diff from current */}
          {trip?.vibes && (
            <div className="mb-4 text-[11px] text-[#7a7a85]">
              {(() => {
                const added = remixVibes.filter(v => !trip.vibes.includes(v))
                const removed = trip.vibes.filter(v => !remixVibes.includes(v))
                if (added.length === 0 && removed.length === 0) return <span className="text-[#4a4a55]">No changes from current vibes</span>
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {added.map(v => <span key={v} className="px-2 py-0.5 rounded-full bg-[rgba(78,205,196,0.12)] text-[#4ecdc4]">+ {v}</span>)}
                    {removed.map(v => <span key={v} className="px-2 py-0.5 rounded-full bg-[rgba(231,76,60,0.12)] text-[#e74c3c]">- {v}</span>)}
                  </div>
                )
              })()}
            </div>
          )}

          {lockedIds.size > 0 && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-[rgba(200,164,78,0.06)] border border-[rgba(200,164,78,0.12)]">
              <span className="text-[11px] text-[#c8a44e]">&#128274; {lockedIds.size} locked item{lockedIds.size > 1 ? 's' : ''} will be kept</span>
            </div>
          )}

          <button
            onClick={() => regenerate('vibes', { vibes: remixVibes })}
            disabled={regenerating || remixVibes.length === 0}
            className="w-full py-3 bg-gradient-to-r from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] font-semibold text-sm rounded-full hover:shadow-lg hover:shadow-[rgba(200,164,78,0.3)] transition-all disabled:opacity-50"
          >
            {regenerating ? 'Remixing...' : `Remix with ${remixVibes.length} vibe${remixVibes.length !== 1 ? 's' : ''}`}
          </button>
        </BottomSheet>
      )}

      {/* ─── Regeneration Overlay ──────────────────── */}
      {regenerating && (
        <div className="fixed inset-0 z-[60] bg-[#08080c]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#c8a44e] to-[#e8cc6e] flex items-center justify-center mx-auto mb-4 animate-pulse">
              <span className="text-2xl">&#10024;</span>
            </div>
            <div className="font-serif text-xl text-[#c8a44e] mb-2">Regenerating your trip</div>
            <p className="text-sm text-[#7a7a85]">Keeping your locked items, refreshing the rest...</p>
          </div>
        </div>
      )}

      {/* ─── Bottom Nav — Floating Pill ─────────── */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0 p-1.5 bg-[rgba(14,14,20,0.88)] backdrop-blur-[28px] border border-[rgba(255,255,255,0.08)] rounded-[22px] shadow-[0_8px_40px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)]">
        {([
          { key: 'board' as const, label: 'Board', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
          { key: 'picks' as const, label: 'Picks', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
          { key: 'alerts' as const, label: 'Alerts', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
          { key: 'flights' as const, label: 'Flights', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg> },
          { key: 'trip' as const, label: 'Trip', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
        ]).map(nav => (
          <button
            key={nav.key}
            onClick={() => setActiveNav(activeNav === nav.key && nav.key !== 'board' ? 'board' : nav.key)}
            className={`relative flex flex-col items-center justify-center w-[52px] h-[44px] rounded-[14px] transition-all duration-300 ${
              activeNav === nav.key
                ? 'text-[#c8a44e] bg-[rgba(200,164,78,0.1)] -translate-y-0.5 shadow-[0_0_20px_rgba(200,164,78,0.12)]'
                : 'text-[#4a4a55] hover:text-[#7a7a85] hover:bg-[rgba(255,255,255,0.04)]'
            }`}
          >
            {activeNav === nav.key && (
              <span className="absolute inset-[-2px] rounded-[16px] border-[1.5px] border-[rgba(200,164,78,0.4)] pointer-events-none" />
            )}
            <span className={`transition-transform duration-300 ${activeNav === nav.key ? 'scale-110' : ''}`}>{nav.icon}</span>
            <span className={`transition-all duration-300 ${activeNav === nav.key ? 'text-[8px] text-[#c8a44e] font-semibold tracking-wider mt-0.5 opacity-100' : 'text-[0px] opacity-0 h-0'}`}>{nav.label}</span>
            {activeNav === nav.key && (
              <span className="absolute -bottom-2 w-1 h-1 rounded-full bg-[#c8a44e] opacity-80" />
            )}
          </button>
        ))}
      </div>

      {/* Spacer for bottom nav */}
      <div className="h-20" />
    </div>
  )
}

// ─── FlowNode Component ────────────────────────────────────────
function FlowNode({ item, onSelect, onStatusChange, menuOpen, onMenuToggle, locked, onToggleLock, onAskAI, onAlternatives, onPriceAlert }: {
  item: ItineraryItem
  onSelect: () => void
  onStatusChange: (id: string, status: ItemStatus) => void
  menuOpen: boolean
  onMenuToggle: () => void
  locked: boolean
  onToggleLock: () => void
  onAskAI: () => void
  onAlternatives: () => void
  onPriceAlert: () => void
}) {
  const catColor = categoryColors[item.category] || '#7a7a85'
  const meta = item.metadata as Record<string, unknown> | null
  const reason = meta?.reason as string | undefined
  const features = (meta?.features || []) as string[]
  const isFlight = item.category === 'flight'
  const width = isFlight ? 'w-[260px] max-md:w-[230px] max-[400px]:w-[200px]' : item.category === 'hotel' ? 'w-[240px] max-md:w-[210px] max-[400px]:w-[185px]' : 'w-[200px] max-md:w-[175px] max-[400px]:w-[155px]'

  // Flight-specific data
  const dep = meta?.departure as { airport: string; time: string; terminal?: string } | undefined
  const arr = meta?.arrival as { airport: string; time: string; terminal?: string } | undefined
  const info = (meta?.info as { l: string; v: string }[]) || []
  const duration = info.find(i => i.l === 'Duration')?.v || ''
  const stops = info.find(i => i.l === 'Stops')?.v || ''
  const airline = info.find(i => i.l === 'Airline')?.v || ''

  // Flight node — special layout
  if (isFlight && dep && arr) {
    const depTime = dep.time.match(/T(\d{2}:\d{2})/)?.[1] || ''
    const arrTime = arr.time.match(/T(\d{2}:\d{2})/)?.[1] || ''

    return (
      <div className={`w-[260px] max-md:w-[230px] max-[400px]:w-[200px] rounded-xl border ${statusBorder(item.status)} overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative group`} style={{ background: 'linear-gradient(135deg, rgba(200,164,78,0.06), #0e0e14)', borderColor: 'rgba(200,164,78,0.2)' }}>
        {/* 3-dot menu (top-right, hover) */}
        <NodeDotsMenu item={item} menuOpen={menuOpen} onMenuToggle={onMenuToggle} locked={locked} onToggleLock={onToggleLock} onAlternatives={onAlternatives} onAskAI={onAskAI} onPriceAlert={onPriceAlert} />

        {/* Route display */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2 cursor-pointer" onClick={onSelect}>
          <div className="text-center flex-shrink-0">
            <div className="text-xl font-light tracking-wider text-[#f0efe8]">{dep.airport}</div>
            <div className="text-[9px] text-[#4a4a55]">{depTime}</div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-0.5">
            <div className="text-[10px] text-[#7a7a85]">{duration}</div>
            <div className="w-full h-[1px] bg-[#c8a44e] relative">
              {stops !== 'Direct' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#7a7a85]" />
              )}
              <div className="absolute -right-0.5 -top-[5px] text-[10px]">&#9992;</div>
            </div>
            <div className="text-[9px] text-[#4a4a55]">{stops}</div>
          </div>
          <div className="text-center flex-shrink-0">
            <div className="text-xl font-light tracking-wider text-[#f0efe8]">{arr.airport}</div>
            <div className="text-[9px] text-[#4a4a55]">{arrTime}</div>
          </div>
        </div>

        {/* Airline + tags bar */}
        <div className="flex items-center justify-between px-3 pb-2 cursor-pointer" onClick={onSelect}>
          <div className="text-[10px] text-[#7a7a85]">{airline}</div>
          <div className="flex gap-1">
            {stops === 'Direct' && <span className="text-[9px] px-1.5 py-0.5 bg-[rgba(255,255,255,0.04)] rounded text-[#7a7a85]">Direct</span>}
            <span className="text-sm font-light text-[#c8a44e]">{item.price}</span>
          </div>
        </div>

        {/* AI reason tag */}
        {reason && (
          <div className="mx-3 mb-2 px-2 py-1 rounded bg-[rgba(200,164,78,0.08)] border border-[rgba(200,164,78,0.12)]">
            <span className="text-[9px] text-[#c8a44e]">&#9830; {reason}</span>
          </div>
        )}

        {/* Action buttons + price */}
        <FlowNodeActions item={item} onStatusChange={onStatusChange} locked={locked} onToggleLock={onToggleLock} />
      </div>
    )
  }

  // Standard node (hotel, activity, food)
  return (
    <div className={`${width} rounded-xl bg-[#0e0e14] border ${locked ? 'border-[#c8a44e] ring-1 ring-[rgba(200,164,78,0.3)]' : statusBorder(item.status)} overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative group`}>
      {/* 3-dot menu (top-right, hover) */}
      <NodeDotsMenu item={item} menuOpen={menuOpen} onMenuToggle={onMenuToggle} locked={locked} onToggleLock={onToggleLock} onAlternatives={onAlternatives} onAskAI={onAskAI} onPriceAlert={onPriceAlert} />

      {/* Lock indicator */}
      {locked && !menuOpen && (
        <div className="absolute top-2 left-2 z-10 w-5 h-5 rounded-full bg-[#c8a44e] flex items-center justify-center text-[10px] text-[#08080c] shadow-sm">
          &#128274;
        </div>
      )}

      {/* Image */}
      {item.image_url && (
        <div className="relative cursor-pointer" onClick={onSelect}>
          <img src={item.image_url} alt={item.name} className="w-full h-[100px] object-cover" />
          <div className="absolute bottom-2 left-2">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider" style={{ background: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44` }}>
              {item.category}
            </span>
          </div>
          {item.time && (
            <div className="absolute bottom-2 right-2 text-[10px] text-[#7a7a85] bg-[#08080c]/80 px-1.5 py-0.5 rounded">
              {item.time}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-3 cursor-pointer" onClick={onSelect}>
        {!item.image_url && (
          <div className="flex items-center gap-2 mb-1">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider" style={{ background: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44` }}>
              {item.category}
            </span>
            {item.time && <span className="text-[10px] text-[#4a4a55]">{item.time}</span>}
          </div>
        )}
        <div className="font-medium text-sm text-[#f0efe8] leading-tight mb-0.5 line-clamp-1">{item.name}</div>
        <div className="text-[11px] text-[#7a7a85] line-clamp-1">{item.detail}</div>

        {/* AI reason tag */}
        {reason && (
          <div className="mt-1.5 px-2 py-1 rounded bg-[rgba(200,164,78,0.08)] border border-[rgba(200,164,78,0.12)]">
            <span className="text-[9px] text-[#c8a44e]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1 -mt-0.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              {reason}
            </span>
          </div>
        )}

        {/* Hotel feature pills */}
        {item.category === 'hotel' && features.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {features.slice(0, 3).map(f => (
              <span key={f} className="text-[8px] px-1.5 py-0.5 bg-[rgba(255,255,255,0.04)] rounded text-[#7a7a85]">{f}</span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons + price */}
      <FlowNodeActions item={item} onStatusChange={onStatusChange} locked={locked} onToggleLock={onToggleLock} />
    </div>
  )
}

// ─── 3-Dot Menu (top-right of node, hover) ──────────────────────
function NodeDotsMenu({ item, menuOpen, onMenuToggle, locked, onToggleLock, onAlternatives, onAskAI, onPriceAlert }: {
  item: ItineraryItem
  menuOpen: boolean
  onMenuToggle: () => void
  locked: boolean
  onToggleLock: () => void
  onAlternatives: () => void
  onAskAI: () => void
  onPriceAlert: () => void
}) {
  return (
    <div className="absolute top-2 right-2 z-10">
      <button
        onClick={(e) => { e.stopPropagation(); onMenuToggle() }}
        className="w-7 h-7 rounded-full bg-[#08080c]/70 backdrop-blur flex items-center justify-center text-[#7a7a85] hover:text-[#f0efe8] opacity-0 group-hover:opacity-100 transition-opacity fc-dots-touch max-md:w-7 max-md:h-7"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-8 z-20 bg-[#18181f] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] py-1 min-w-[160px]">
          <button onClick={(e) => { e.stopPropagation(); onAlternatives() }} className="w-full text-left px-3 py-2 text-xs text-[#f0efe8] hover:bg-[rgba(255,255,255,0.04)] flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            Alternatives
          </button>
          <button onClick={(e) => { e.stopPropagation(); onAskAI() }} className="w-full text-left px-3 py-2 text-xs text-[#f0efe8] hover:bg-[rgba(255,255,255,0.04)] flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Ask AI
          </button>
          <button onClick={(e) => { e.stopPropagation(); onPriceAlert() }} className="w-full text-left px-3 py-2 text-xs text-[#f0efe8] hover:bg-[rgba(255,255,255,0.04)] flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Set Price Alert
          </button>
          <div className="border-t border-[rgba(255,255,255,0.06)] my-1" />
          <button onClick={(e) => { e.stopPropagation(); onToggleLock(); onMenuToggle() }} className={`w-full text-left px-3 py-2 text-xs hover:bg-[rgba(255,255,255,0.04)] flex items-center gap-2 ${locked ? 'text-[#c8a44e]' : 'text-[#f0efe8]'}`}>
            <span className="text-[11px]">{locked ? '\u{1F512}' : '\u{1F513}'}</span>{locked ? 'Unlock Item' : 'Lock Item'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Shared Action Buttons for FlowNode (bottom bar) ────────────
function FlowNodeActions({ item, onStatusChange, locked, onToggleLock }: {
  item: ItineraryItem
  onStatusChange: (id: string, status: ItemStatus) => void
  locked: boolean
  onToggleLock: () => void
}) {
  return (
    <div className="flex items-center justify-between px-3 pb-2">
      <div className="flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, item.status === 'picked' ? 'none' : 'picked') }}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${item.status === 'picked' ? 'bg-[#4ecdc4] text-[#08080c]' : 'bg-[rgba(255,255,255,0.04)] text-[#7a7a85] hover:bg-[rgba(255,255,255,0.08)]'}`}
          title="Pick"
        ><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
        <button
          onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, item.status === 'skipped' ? 'none' : 'skipped') }}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${item.status === 'skipped' ? 'bg-[#e74c3c] text-white' : 'bg-[rgba(255,255,255,0.04)] text-[#7a7a85] hover:bg-[rgba(255,255,255,0.08)]'}`}
          title="Skip"
        ><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        <button
          onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, item.status === 'saved' ? 'none' : 'saved') }}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${item.status === 'saved' ? 'bg-[#c8a44e] text-[#08080c]' : 'bg-[rgba(255,255,255,0.04)] text-[#7a7a85] hover:bg-[rgba(255,255,255,0.08)]'}`}
          title="Save"
        ><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleLock() }}
          className={`text-[10px] transition-colors ${locked ? 'text-[#c8a44e]' : 'text-[#4a4a55] hover:text-[#7a7a85]'}`}
          title={locked ? 'Unlock' : 'Lock'}
        >{locked ? '\u{1F512}' : '\u{1F513}'}</button>
        <span className="text-sm font-light" style={{ color: categoryColors[item.category] || '#7a7a85' }}>{item.price}</span>
      </div>
    </div>
  )
}

// ─── Bottom Sheet ──────────────────────────────────────────────
function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-[#0e0e14] border-t border-[rgba(255,255,255,0.08)] rounded-t-[20px] overflow-y-auto animate-[slideUp_0.3s_ease]">
        <div className="sticky top-0 flex justify-center pt-3 pb-1 bg-[#0e0e14] z-10">
          <div className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
        </div>
        <div className="px-6 pb-8">{children}</div>
      </div>
    </div>
  )
}

// ─── Item Detail ───────────────────────────────────────────────
function ItemDetail({ item, onPick, onAlternatives, onAskAI }: {
  item: ItineraryItem; onPick: () => void; onAlternatives: () => void; onAskAI: () => void
}) {
  const [whyExpanded, setWhyExpanded] = useState(false)
  const catColor = categoryColors[item.category] || '#7a7a85'
  const meta = item.metadata as Record<string, unknown> | null
  const info = (meta?.info || []) as { l: string; v: string }[]
  const features = (meta?.features || []) as string[]
  const reason = meta?.reason as string | undefined
  const whyFactors = (meta?.whyFactors || []) as string[]
  const honestTake = meta?.honest_take as string | undefined
  const bookingUrl = meta?.bookingUrl as string | undefined

  // AI nudge messages based on category
  const nudgeMessages: Record<string, { text: string; actions: string[] }> = {
    hotel: { text: 'Want me to check if there\'s a better room type, or compare this with nearby options?', actions: ['Find better rates', 'Compare nearby hotels', 'Check availability'] },
    flight: { text: 'I can look for alternative routes, different times, or upgrade options.', actions: ['Find cheaper flights', 'Try different dates', 'Check upgrades'] },
    activity: { text: 'I can find similar experiences, check the best time to visit, or suggest combos.', actions: ['Similar activities', 'Best time to go', 'Pair with nearby food'] },
    food: { text: 'Want recommendations for what to order, or similar restaurants nearby?', actions: ['What to order', 'Similar restaurants', 'Reserve a table'] },
  }
  const nudge = nudgeMessages[item.category]

  return (
    <div>
      {item.image_url && (
        <div className="relative -mx-6 -mt-1 mb-4">
          <img src={item.image_url} alt={item.name} className="w-full h-[220px] object-cover" />
          <div className="absolute bottom-3 left-4">
            <span className="px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider" style={{ background: `${catColor}dd`, color: '#08080c' }}>
              {item.category}
            </span>
          </div>
        </div>
      )}

      <h2 className="font-serif text-2xl mb-1">{item.name}</h2>
      <p className="text-sm text-[#7a7a85] mb-4">{item.description || item.detail}</p>

      {info.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          {info.map((i, idx) => (
            <div key={idx} className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3 text-center">
              <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mb-1">{i.l}</div>
              <div className="text-sm text-[#f0efe8]">{i.v}</div>
            </div>
          ))}
        </div>
      )}

      {features.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {features.map(f => (
            <span key={f} className="px-2.5 py-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-full text-[11px] text-[#7a7a85]">{f}</span>
          ))}
        </div>
      )}

      {/* Honest take */}
      {honestTake && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
          <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mb-1">Honest Take</div>
          <div className="text-[12px] text-[#7a7a85] leading-relaxed">{honestTake}</div>
        </div>
      )}

      {/* Why Drift picked this — expandable */}
      {(reason || whyFactors.length > 0) && (
        <div className="mb-4">
          <button
            onClick={() => setWhyExpanded(!whyExpanded)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[rgba(200,164,78,0.06)] border border-[rgba(200,164,78,0.12)] hover:bg-[rgba(200,164,78,0.1)] transition-colors"
          >
            <span className="text-[12px] text-[#c8a44e] font-medium">&#9830; Why did Drift pick this?</span>
            <span className="text-[#c8a44e] text-xs">{whyExpanded ? '&#9650;' : '&#9660;'}</span>
          </button>
          {whyExpanded && (
            <div className="mt-2 px-3 space-y-1.5">
              {reason && <div className="text-[12px] text-[#c8a44e] font-medium">{reason}</div>}
              {whyFactors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px] text-[#7a7a85]">
                  <span className="text-[#4ecdc4] mt-0.5">&#10003;</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Price + booking row */}
      <div className="flex items-center justify-between pt-4 border-t border-[rgba(255,255,255,0.06)]">
        <div className="text-2xl font-light" style={{ color: catColor }}>{item.price}</div>
        <div className="flex gap-2">
          {bookingUrl && (
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg text-xs text-[#08080c] bg-[#4ecdc4] font-medium hover:bg-[#5dded5]">
              Book
            </a>
          )}
          <button onClick={onAskAI} className="px-4 py-2 rounded-lg text-xs text-[#7a7a85] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]">
            Ask AI
          </button>
          <button onClick={onAlternatives} className="px-4 py-2 rounded-lg text-xs text-[#7a7a85] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]">
            Alternatives
          </button>
          <button onClick={onPick} className={`px-5 py-2 rounded-lg text-xs font-medium ${item.status === 'picked' ? 'bg-[#4ecdc4] text-[#08080c]' : 'bg-[#c8a44e] text-[#08080c]'}`}>
            {item.status === 'picked' ? 'Picked' : 'Pick This'}
          </button>
        </div>
      </div>

      {/* AI Nudge */}
      {nudge && (
        <div className="mt-4 p-3 rounded-xl border border-[rgba(200,164,78,0.15)] bg-[rgba(200,164,78,0.04)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-[#c8a44e] to-[#e8cc6e] flex items-center justify-center text-[8px] font-bold text-[#08080c]">D</span>
            <span className="text-[11px] text-[#c8a44e]">{nudge.text}</span>
          </div>
          <div className="flex gap-2">
            {nudge.actions.map(a => (
              <button key={a} onClick={() => onAskAI()} className="px-3 py-1.5 rounded-full text-[10px] text-[#c8a44e] border border-[rgba(200,164,78,0.25)] hover:bg-[rgba(200,164,78,0.1)]">
                {a}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Alternatives Panel ────────────────────────────────────────
function AlternativesPanel({ item, onSwap }: { item: ItineraryItem; onSwap?: (newData: { name: string; detail: string; price: string; image_url?: string; bookingUrl?: string }) => void }) {
  const meta = item.metadata as Record<string, unknown> | null
  const alts = (meta?.alts || []) as Alt[]
  const catColor = categoryColors[item.category] || '#7a7a85'

  return (
    <div>
      <h2 className="font-serif text-xl mb-1">Alternatives to {item.name}</h2>
      <p className="text-sm text-[#7a7a85] mb-5">Compare other options for this {item.category}</p>

      {alts.length === 0 ? (
        <p className="text-sm text-[#4a4a55]">No alternatives available for this item.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {alts.map((alt, i) => (
            <div key={i} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
              {alt.image_url && <img src={alt.image_url} alt={alt.name} className="w-full h-[120px] object-cover" />}
              <div className="p-3">
                <div className="font-medium text-sm mb-0.5">{alt.name}</div>
                <div className="text-[11px] text-[#7a7a85] mb-2 line-clamp-2">{alt.detail}</div>
                {/* Trust badges */}
                {alt.trust && alt.trust.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {alt.trust.map((badge, bi) => (
                      <span key={bi} className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                        badge.type === 'success' ? 'bg-[rgba(78,205,196,0.12)] text-[#4ecdc4] border border-[rgba(78,205,196,0.2)]' :
                        badge.type === 'gold' ? 'bg-[rgba(200,164,78,0.12)] text-[#c8a44e] border border-[rgba(200,164,78,0.2)]' :
                        'bg-[rgba(240,165,0,0.12)] text-[#f0a500] border border-[rgba(240,165,0,0.2)]'
                      }`}>{badge.text}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light" style={{ color: catColor }}>{alt.price}</span>
                  <div className="flex gap-1.5">
                    {alt.bookingUrl && (
                      <a href={alt.bookingUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded text-[10px] font-medium bg-[#4ecdc4] text-[#08080c] hover:bg-[#5dded5]">
                        Book
                      </a>
                    )}
                    <button
                      onClick={() => onSwap?.({ name: alt.name, detail: alt.detail, price: alt.price, image_url: alt.image_url, bookingUrl: alt.bookingUrl })}
                      className="px-3 py-1 rounded text-[10px] font-medium bg-[rgba(255,255,255,0.06)] text-[#f0efe8] hover:bg-[rgba(255,255,255,0.1)]"
                    >
                      Swap
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Chat Panel ────────────────────────────────────────────────
function ChatPanel({ messages, loading, input, contextItem, onInputChange, onSend, onClose, onClearContext, onSwap }: {
  messages: ChatMsg[]
  loading: boolean
  input: string
  contextItem: ItineraryItem | null
  onInputChange: (v: string) => void
  onSend: (text?: string) => void
  onClose: () => void
  onClearContext: () => void
  onSwap?: (newData: { name: string; detail: string; price: string; image_url?: string; bookingUrl?: string }) => void
}) {
  const messagesEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const suggestions = contextItem
    ? [`What's special about ${contextItem.name}?`, 'Show me cheaper options', 'Is this worth it?']
    : ['Suggest a hidden gem', 'Optimize my budget', 'What should I skip?']

  return (
    <div className="fixed bottom-[82px] right-6 z-50 w-[380px] h-[520px] bg-[#0e0e14] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.6)] backdrop-blur flex flex-col overflow-hidden animate-[slideUp_0.2s_ease] chat-panel-mobile max-md:bottom-0 max-md:right-0 max-md:rounded-none max-md:border-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#c8a44e] animate-pulse" />
          <span className="font-serif text-sm">Drift AI</span>
        </div>
        <button onClick={onClose} className="text-[#7a7a85] hover:text-[#f0efe8] text-lg">&times;</button>
      </div>

      {/* Context */}
      {contextItem && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(200,164,78,0.08)] border-b border-[rgba(255,255,255,0.04)]">
          {contextItem.image_url && <img src={contextItem.image_url} alt="" className="w-8 h-8 rounded object-cover" />}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-[#c8a44e] font-medium truncate">{contextItem.name}</div>
            <div className="text-[9px] text-[#7a7a85]">{contextItem.category}</div>
          </div>
          <button onClick={onClearContext} className="text-[#7a7a85] text-sm">&times;</button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="font-serif text-lg text-[#c8a44e] mb-1">Hey there</div>
            <div className="text-xs text-[#7a7a85]">Ask me anything about your trip</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#c8a44e] text-[#08080c] rounded-br-sm'
                : 'bg-[rgba(255,255,255,0.06)] text-[#f0efe8] rounded-bl-sm'
            }`}>
              {msg.content}
              {/* Swap-inline: show when AI mentions an alternative and context item exists */}
              {msg.role === 'assistant' && onSwap && contextItem && i === messages.length - 1 && (() => {
                const meta = contextItem.metadata as Record<string, unknown> | null
                const alts = (meta?.alts || []) as Alt[]
                // Check if AI response mentions any alternative by name
                const mentionedAlt = alts.find(a => msg.content.toLowerCase().includes(a.name.toLowerCase()))
                if (!mentionedAlt) return null
                return (
                  <button
                    onClick={() => onSwap({ name: mentionedAlt.name, detail: mentionedAlt.detail, price: mentionedAlt.price, image_url: mentionedAlt.image_url, bookingUrl: mentionedAlt.bookingUrl })}
                    className="block mt-2 px-3 py-1.5 bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-lg text-[11px] text-[#c8a44e] hover:bg-[#c8a44e] hover:text-[#08080c] hover:border-[#c8a44e] transition-colors"
                  >
                    &#8594; Swap {mentionedAlt.name} into board
                  </button>
                )
              })()}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[rgba(255,255,255,0.06)] px-4 py-2 rounded-xl rounded-bl-sm flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7a7a85] animate-bounce [animation-delay:0s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#7a7a85] animate-bounce [animation-delay:0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#7a7a85] animate-bounce [animation-delay:0.3s]" />
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map(s => (
            <button key={s} onClick={() => onSend(s)} className="px-3 py-1.5 rounded-full text-[10px] text-[#c8a44e] border border-[rgba(200,164,78,0.25)] hover:bg-[rgba(200,164,78,0.1)]">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.06)]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder="Ask about your trip..."
            className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#f0efe8] placeholder-[#4a4a55] outline-none focus:border-[rgba(200,164,78,0.3)]"
          />
          <button
            onClick={() => onSend()}
            disabled={loading}
            className="px-3 py-2 bg-[#c8a44e] text-[#08080c] rounded-lg text-sm font-medium hover:bg-[#e8cc6e] disabled:opacity-50"
          >
            &uarr;
          </button>
        </div>
      </div>
    </div>
  )
}

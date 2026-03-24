'use client'

import { useState, useRef, useEffect } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useTripStore } from '@/stores/trip-store'
import { trackEvent } from '@/lib/analytics'

const suggestions = [
  'What should I pack?',
  'Best time to visit?',
  'Any hidden gems?',
  'Review my itinerary',
]

/** Render simple markdown: **bold**, *italic*, bullet lists, line breaks */
function renderMarkdown(text: string) {
  if (!text) return null

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Bullet points
    if (line.match(/^\s*[-•]\s+/)) {
      const content = line.replace(/^\s*[-•]\s+/, '')
      elements.push(
        <div key={i} className="flex gap-1.5 pl-1">
          <span className="mt-[1px] text-drift-gold/60">•</span>
          <span>{formatInline(content)}</span>
        </div>
      )
      continue
    }

    // Empty lines → spacing
    if (!line.trim()) {
      if (i > 0 && i < lines.length - 1) {
        elements.push(<div key={i} className="h-1.5" />)
      }
      continue
    }

    // Regular text
    elements.push(<div key={i}>{formatInline(line)}</div>)
  }

  return <>{elements}</>
}

/** Format inline markdown: **bold** and *italic* */
function formatInline(text: string): React.ReactNode {
  // Split by **bold** and *italic* patterns
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[2]) {
      // **bold**
      parts.push(<strong key={match.index} className="font-semibold text-drift-text">{match[2]}</strong>)
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={match.index}>{match[3]}</em>)
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? <>{parts}</> : text
}

export default function ChatOverlay() {
  const { showChat, chatInitMessage, chatContextItemId, closeChat } = useUIStore()
  const { currentTrip, token, chatHistory, addChatMessage, updateLastChatMessage } = useTripStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Handle init message
  useEffect(() => {
    if (showChat && chatInitMessage) {
      sendMessage(chatInitMessage)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChat, chatInitMessage])

  // Auto-scroll
  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatHistory])

  // Focus input
  useEffect(() => {
    if (!showChat) return
    const t = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [showChat])

  const sendMessage = async (text: string) => {
    if (!text.trim() || !currentTrip || !token || loading) return

    setShowSuggestions(false)
    addChatMessage({ role: 'user', content: text })
    setInput('')
    setLoading(true)
    trackEvent('chat_message', 'engagement')

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tripId: currentTrip.id,
          message: text,
          stream: true,
          contextItemId: chatContextItemId || undefined,
        }),
      })

      // Check if streaming response (SSE)
      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        // Add placeholder assistant message that we'll update
        addChatMessage({ role: 'assistant', content: '' })
        setLoading(false) // Hide bouncing dots, show streaming text

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalText = ''
        let finalActions: Array<{ type: string; [key: string]: unknown }> = []

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            // Parse SSE events from buffer
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep incomplete line in buffer

            let eventType = ''
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7)
              } else if (line.startsWith('data: ')) {
                const data = line.slice(6)
                try {
                  const parsed = JSON.parse(data)
                  if (eventType === 'text') {
                    finalText = parsed.content || ''
                    updateLastChatMessage({ content: finalText })
                  } else if (eventType === 'tool') {
                    // Show tool progress as temporary text
                    updateLastChatMessage({ content: parsed.label || 'Thinking...' })
                  } else if (eventType === 'actions') {
                    finalActions = parsed.actions || []
                    if (finalActions.length > 0) {
                      updateLastChatMessage({ actions: finalActions })
                    }
                    if (finalActions.some((a) => a.type === 'swap')) {
                      trackEvent('item_swapped', 'engagement')
                    }
                  }
                } catch { /* skip malformed events */ }
              }
            }
          }
        }

        // Save assistant message to DB
        if (finalText && currentTrip.id) {
          fetch('/api/ai/chat/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              tripId: currentTrip.id,
              content: finalText,
              contextItemId: chatContextItemId || undefined,
            }),
          }).catch(() => {})
        }
      } else {
        // Non-streaming fallback
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        addChatMessage({ role: 'assistant', content: data.text, actions: data.actions })
        if (data.actions?.some((a: { type: string }) => a.type === 'swap')) {
          trackEvent('item_swapped', 'engagement')
        }
        setLoading(false)
      }
    } catch {
      addChatMessage({ role: 'assistant', content: 'Sorry, something went wrong. Try again?' })
      setLoading(false)
    }
  }

  return (
    <div className={`fixed inset-0 z-[160] transition-opacity duration-300 ${showChat ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeChat} />

      <div className={`absolute bottom-0 left-0 right-0 flex h-[75vh] flex-col rounded-t-2xl border-t border-drift-border2 bg-drift-card transition-transform duration-500 ease-[var(--ease-spring)] ${showChat ? 'translate-y-0' : 'translate-y-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-drift-border2 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-drift-gold-dim text-[9px] font-extrabold text-drift-bg">
              D
            </div>
            <div>
              <div className="text-sm font-semibold text-drift-text">Drift</div>
              <div className="text-[9px] text-drift-text3">AI Travel Assistant</div>
            </div>
          </div>
          <button onClick={closeChat} aria-label="Close chat" className="text-drift-text3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-4">
          {chatHistory.length === 0 && !loading && (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <div className="mb-2 text-sm text-drift-text2">Ask me anything about your trip</div>
                <div className="text-[10px] text-drift-text3">I can swap items, add activities, or answer questions</div>
              </div>
            </div>
          )}

          {chatHistory.map((msg, i) => (
            <div key={i} className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-[msg-in_0.3s_var(--ease-smooth)]`}>
              {msg.role === 'assistant' && (
                <div className="mr-2 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-drift-gold-dim text-[7px] font-bold text-drift-bg">
                  D
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-drift-gold text-drift-bg rounded-br-sm'
                  : 'bg-drift-surface2 text-drift-text2 rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="mb-3 flex justify-start animate-[msg-in_0.3s_var(--ease-smooth)]">
              <div className="mr-2 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-drift-gold-dim text-[7px] font-bold text-drift-bg">D</div>
              <div className="flex gap-1 rounded-2xl bg-drift-surface2 px-4 py-3 rounded-bl-sm">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full bg-drift-text3 animate-[typing-dot_1.4s_infinite]" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {showSuggestions && chatHistory.length === 0 && (
          <div className="flex gap-2 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="shrink-0 rounded-full border border-drift-gold/20 bg-drift-gold-bg px-3 py-1.5 text-[10px] font-medium text-drift-gold"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-drift-border2 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              placeholder="Ask about your trip..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-drift-border2 bg-transparent px-3.5 py-2.5 text-sm text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-drift-gold text-drift-bg disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

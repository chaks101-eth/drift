'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTripStore } from '@/stores/trip-store'

const SUGGESTIONS = [
  'How does my trip look?',
  'Find me cheaper hotels',
  'Add a spa day',
  'What should I pack?',
]

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  tripId: string
}

export default function ChatPanel({ open, onClose, tripId }: ChatPanelProps) {
  const token = useTripStore((s) => s.token)
  const { chatHistory, addChatMessage, updateLastChatMessage } = useTripStore()
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatHistory])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming || !token) return
    const msg = text.trim()
    setInput('')
    setStreaming(true)

    addChatMessage({ role: 'user', content: msg })
    addChatMessage({ role: 'assistant', content: '' })

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tripId, message: msg }),
      })

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let fullText = ''

        while (reader) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.text) { fullText += data.text; updateLastChatMessage({ content: fullText }) }
                if (data.done) updateLastChatMessage({ content: fullText })
              } catch { /* skip */ }
            }
          }
        }
      } else {
        const data = await res.json()
        updateLastChatMessage({ content: data.reply || data.message || 'Sorry, I couldn\'t process that.' })
      }
    } catch {
      updateLastChatMessage({ content: 'Something went wrong. Try again.' })
    } finally {
      setStreaming(false)
    }
  }, [token, tripId, streaming, addChatMessage, updateLastChatMessage])

  return (
    <div className={`fixed right-0 top-0 bottom-0 z-[200] flex w-[440px] flex-col border-l border-drift-border bg-drift-bg/95 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-drift-border px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-drift-gold/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <span className="font-serif text-lg text-drift-text">Chat with Drift</span>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-drift-surface transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {chatHistory.length === 0 && (
          <div className="text-center py-12">
            <div className="font-serif text-xl text-drift-text mb-2">Ask anything about your trip</div>
            <p className="text-[12px] text-drift-text3 mb-6">Swap hotels, find cheaper options, add activities, or get local tips.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-drift-border px-4 py-2 text-[11px] text-drift-text3 hover:border-drift-gold/20 hover:text-drift-gold transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-drift-gold/10">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
            )}
            <div className={`max-w-[320px] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
              msg.role === 'user'
                ? 'bg-drift-gold/10 border border-drift-gold/15 text-drift-text rounded-tr-sm'
                : 'bg-drift-surface border border-drift-border text-drift-text2 rounded-tl-sm'
            }`}>
              {msg.content || (streaming && i === chatHistory.length - 1 ? (
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-drift-gold animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-drift-gold animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-drift-gold animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              ) : '')}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-drift-border px-4 py-3">
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
            className="flex-1 resize-none rounded-xl border border-drift-border bg-transparent px-4 py-3 text-[13px] text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none max-h-[120px] overflow-y-auto"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-drift-gold text-drift-bg disabled:opacity-30 transition-opacity"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

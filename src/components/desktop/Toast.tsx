'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/stores/ui-store'

export default function DesktopToast() {
  const { toastText, toastError, toastVisible, toastUndo, hideToast } = useUIStore()

  useEffect(() => {
    if (!toastVisible) return
    const t = setTimeout(hideToast, 3500)
    return () => clearTimeout(t)
  }, [toastVisible, toastText, hideToast])

  if (!toastVisible) return null

  return (
    <div className="fixed top-20 right-6 z-[400] max-w-[380px] animate-[slideInRight_0.4s_cubic-bezier(0.34,1.56,0.64,1)]">
      <div className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] ${
        toastError
          ? 'bg-drift-err/10 border-drift-err/20'
          : 'bg-[rgba(14,14,20,0.95)] border-drift-ok/20'
      }`}>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          toastError ? 'bg-drift-err/15 text-drift-err' : 'bg-drift-ok/15 text-drift-ok'
        }`}>
          {toastError ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div className="flex-1 text-[13px] text-drift-text">{toastText}</div>
        {toastUndo && (
          <button
            onClick={() => { toastUndo(); hideToast() }}
            className="text-[11px] font-bold uppercase tracking-wider text-drift-gold hover:text-drift-gold/80"
          >
            Undo
          </button>
        )}
        <button onClick={hideToast} className="text-drift-text3 hover:text-drift-text transition-colors">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

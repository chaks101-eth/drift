'use client'

import { useEffect, useRef } from 'react'
import { useUIStore } from '@/stores/ui-store'

export default function Toast() {
  const { toastText, toastError, toastVisible, toastUndo, hideToast } = useUIStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (toastVisible) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(hideToast, 3500)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toastVisible, hideToast])

  return (
    <div
      className={`fixed left-1/2 z-[200] -translate-x-1/2 transition-all duration-300 ${
        toastVisible
          ? 'bottom-[100px] opacity-100 translate-y-0'
          : 'bottom-[100px] opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <div
        className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-xs font-medium shadow-lg backdrop-blur-xl ${
          toastError
            ? 'border-drift-err/30 bg-drift-card/95'
            : 'border-drift-gold/20 bg-drift-card/95'
        }`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            toastError ? 'bg-drift-err' : 'bg-drift-gold'
          }`}
        />
        <span className="whitespace-nowrap text-drift-text">{toastText}</span>
        {toastUndo && (
          <button
            onClick={() => {
              toastUndo()
              hideToast()
            }}
            className="ml-1 font-bold text-drift-gold"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  )
}

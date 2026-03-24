'use client'

import { useEffect, useRef } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export default function BottomSheet({ open, onClose, children, className = '' }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return (
    <div
      className={`fixed inset-0 z-[150] transition-opacity duration-300 ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`absolute bottom-0 left-0 right-0 max-h-[92vh] overflow-y-auto rounded-t-2xl border-t border-drift-border2 bg-drift-card transition-transform duration-500 ease-[var(--ease-spring)] ${
          open ? 'translate-y-0' : 'translate-y-full'
        } ${className}`}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-9 rounded-full bg-white/15" />
        </div>
        {children}
      </div>
    </div>
  )
}

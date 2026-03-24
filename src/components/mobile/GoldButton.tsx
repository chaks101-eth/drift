'use client'

interface GoldButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  ready?: boolean
  className?: string
  type?: 'button' | 'submit'
}

export default function GoldButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  ready = true,
  className = '',
  type = 'button',
}: GoldButtonProps) {
  const isDisabled = disabled || loading || !ready

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        relative w-full overflow-hidden rounded-[14px] px-6 py-4
        text-xs font-extrabold uppercase tracking-widest
        transition-all duration-300
        ${isDisabled
          ? 'bg-drift-gold/30 text-drift-text3 cursor-not-allowed'
          : 'bg-drift-gold text-drift-bg shadow-[0_12px_36px_rgba(200,164,78,0.18)] active:scale-[0.97]'
        }
        ${className}
      `}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Processing…
        </span>
      ) : (
        children
      )}
      {/* Shine animation */}
      {!isDisabled && (
        <span className="absolute left-[-100%] top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shine_5s_ease-in-out_2s_infinite]" />
      )}
    </button>
  )
}

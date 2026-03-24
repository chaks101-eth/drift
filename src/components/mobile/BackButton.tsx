'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  href?: string
  onClick?: () => void
  className?: string
}

export default function BackButton({ href, onClick, className = '' }: BackButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`flex h-9 w-9 items-center justify-center bg-transparent border-none text-drift-text ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )
}

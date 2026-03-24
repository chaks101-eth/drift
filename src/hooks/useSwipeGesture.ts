import { useRef, useCallback } from 'react'

interface SwipeState {
  startX: number
  startY: number
  deltaX: number
  deltaY: number
  dragging: boolean
}

interface UseSwipeOptions {
  threshold?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

export function useSwipeGesture({ threshold = 80, onSwipeLeft, onSwipeRight }: UseSwipeOptions) {
  const stateRef = useRef<SwipeState>({ startX: 0, startY: 0, deltaX: 0, deltaY: 0, dragging: false })
  const cardRef = useRef<HTMLDivElement>(null)

  const onStart = useCallback((clientX: number, clientY: number) => {
    stateRef.current = { startX: clientX, startY: clientY, deltaX: 0, deltaY: 0, dragging: true }
  }, [])

  const onMove = useCallback((clientX: number, clientY: number) => {
    const s = stateRef.current
    if (!s.dragging) return

    s.deltaX = clientX - s.startX
    s.deltaY = clientY - s.startY

    if (cardRef.current) {
      const rotate = s.deltaX * 0.08
      cardRef.current.style.transition = 'none'
      cardRef.current.style.transform = `translateX(${s.deltaX}px) translateY(${s.deltaY * 0.3}px) rotate(${rotate}deg)`
      cardRef.current.style.opacity = String(1 - Math.abs(s.deltaX) / 600)
    }
  }, [])

  const onEnd = useCallback(() => {
    const s = stateRef.current
    s.dragging = false

    if (Math.abs(s.deltaX) > threshold) {
      // Fly out
      const dir = s.deltaX > 0 ? 'right' : 'left'
      if (cardRef.current) {
        const flyX = s.deltaX > 0 ? 500 : -500
        const flyRotate = s.deltaX > 0 ? 30 : -30
        cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1), opacity 0.3s'
        cardRef.current.style.transform = `translateX(${flyX}px) rotate(${flyRotate}deg)`
        cardRef.current.style.opacity = '0'
      }
      if (dir === 'right') onSwipeRight?.()
      else onSwipeLeft?.()
    } else {
      // Spring back
      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.1), opacity 0.3s'
        cardRef.current.style.transform = 'translateX(0) translateY(0) rotate(0)'
        cardRef.current.style.opacity = '1'
      }
    }

    s.deltaX = 0
    s.deltaY = 0
  }, [threshold, onSwipeLeft, onSwipeRight])

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => onStart(e.touches[0].clientX, e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => onMove(e.touches[0].clientX, e.touches[0].clientY),
    onTouchEnd: () => onEnd(),
    onMouseDown: (e: React.MouseEvent) => onStart(e.clientX, e.clientY),
    onMouseMove: (e: React.MouseEvent) => { if (stateRef.current.dragging) onMove(e.clientX, e.clientY) },
    onMouseUp: () => onEnd(),
    onMouseLeave: () => { if (stateRef.current.dragging) onEnd() },
  }

  return { cardRef, handlers, stateRef }
}

'use client'

/**
 * Editorial placeholder for itinerary items that don't have a real photo.
 *
 * Used when:
 *  - Generation pipeline couldn't find a Google Places / SerpAPI photo
 *  - The real image_url failed to load in the browser
 *
 * Honest design: doesn't pretend to be a photo of the place. Shows the
 * category icon and the place's initial letter on a category-tinted gradient,
 * so a board with placeholders still feels intentional and varied per item
 * (the initial + hash makes each placeholder visually distinct).
 */

interface Props {
  category: string
  name: string
  className?: string
  iconScale?: number // 1 = default, smaller for compact cards
}

// Category-tinted gradients — drawn from drift-gold + drift-ok + drift-warn
const CATEGORY_GRADIENTS: Record<string, string> = {
  hotel:    'linear-gradient(135deg, #1c2624 0%, #0c1a18 60%, #08080c 100%)',
  food:     'linear-gradient(135deg, #2a1f12 0%, #1a1208 60%, #08080c 100%)',
  activity: 'linear-gradient(135deg, #1f1e2c 0%, #131221 60%, #08080c 100%)',
  flight:   'linear-gradient(135deg, #1a1a26 0%, #0c0c14 60%, #08080c 100%)',
  transfer: 'linear-gradient(135deg, #1a1a1f 0%, #0d0d11 60%, #08080c 100%)',
  default:  'linear-gradient(135deg, #1c1c24 0%, #0e0e14 60%, #08080c 100%)',
}

const CATEGORY_ACCENT: Record<string, string> = {
  hotel:    '#4ecdc4',
  food:     '#c8a44e',
  activity: '#c8a44e',
  flight:   '#c8a44e',
  transfer: '#7a7a85',
  default:  '#c8a44e',
}

// Inline SVGs for the icons — same set the cards use elsewhere, sized to fill
const ICONS: Record<string, React.ReactNode> = {
  hotel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 7v14M21 7v14M6 11h4M14 11h4M6 15h4M14 15h4M10 21V7l2-4 2 4v14" />
    </svg>
  ),
  food: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  ),
  flight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  ),
  transfer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
}

function hashCode(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i)
    hash |= 0
  }
  return hash
}

export default function PlaceholderImage({ category, name, className = '', iconScale = 1 }: Props) {
  const gradient = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.default
  const accent = CATEGORY_ACCENT[category] || CATEGORY_ACCENT.default
  const icon = ICONS[category] || ICONS.activity
  const initial = (name?.trim()?.[0] || '?').toUpperCase()
  // Slight rotation + offset per item so placeholders don't look identical
  const rot = (Math.abs(hashCode(name)) % 7) - 3 // -3..+3 deg
  const offX = (Math.abs(hashCode(name + 'x')) % 18) - 9 // -9..+9 px
  const offY = (Math.abs(hashCode(name + 'y')) % 12) - 6 // -6..+6 px
  const iconSize = 48 * iconScale

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} style={{ background: gradient }}>
      {/* Subtle radial highlight */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at ${30 + offX}% ${30 + offY}%, ${accent}15 0%, transparent 55%)`,
        }}
      />
      {/* Grain noise for editorial texture */}
      <div
        className="absolute inset-0 mix-blend-overlay opacity-25"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.55'/></svg>\")",
        }}
      />
      {/* The serif initial — like an editorial monogram */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) rotate(${rot}deg)`,
        }}
      >
        <span
          className="font-serif italic"
          style={{
            fontSize: 120 * iconScale,
            lineHeight: 1,
            color: `${accent}22`,
            letterSpacing: '-0.06em',
          }}
        >
          {initial}
        </span>
      </div>
      {/* Category icon centered on top */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: iconSize + 18,
            height: iconSize + 18,
            background: `${accent}10`,
            border: `1px solid ${accent}30`,
            backdropFilter: 'blur(2px)',
            color: accent,
          }}
        >
          <div style={{ width: iconSize * 0.55, height: iconSize * 0.55 }}>{icon}</div>
        </div>
      </div>
    </div>
  )
}

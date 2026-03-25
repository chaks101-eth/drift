import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import type { ReelProps } from '../types'

// ─── Brand Constants ─────────────────────────────────────────

const C = {
  bg: '#08080c',
  surface: '#0e0e14',
  gold: '#c8a44e',
  goldLight: 'rgba(200, 164, 78, 0.15)',
  text: '#f0efe8',
  muted: '#7a7a85',
  dim: '#4a4a55',
}

// ─── Intro Slide ─────────────────────────────────────────────

function IntroSlide({ destination, country, vibes, evalScore }: {
  destination: string; country: string; vibes: string[]; evalScore?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const logoOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
  const titleY = interpolate(frame, [8, 25], [50, 0], { extrapolateRight: 'clamp' })
  const titleOp = interpolate(frame, [8, 25], [0, 1], { extrapolateRight: 'clamp' })
  const vibeOp = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: 'clamp' })
  const scoreScale = spring({ frame: frame - 30, fps, config: { damping: 12 } })
  // Subtle background pulse
  const bgBrightness = interpolate(frame, [0, 45, 90], [0.8, 1, 0.8])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', filter: `brightness(${bgBrightness})` }}>
      {/* Subtle radial glow */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,164,78,0.06) 0%, transparent 70%)',
        top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
      }} />

      <div style={{ opacity: logoOp, fontFamily: 'Georgia, serif', fontSize: 28, color: C.gold, letterSpacing: 6, marginBottom: 50 }}>
        DRIFT
      </div>

      <div style={{ transform: `translateY(${titleY}px)`, opacity: titleOp, textAlign: 'center', padding: '0 40px' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 64, fontWeight: 600, color: C.text, lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: 4 }}>
          {destination}
        </div>
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22, color: C.muted, marginTop: 10, letterSpacing: 8, textTransform: 'uppercase' }}>
          {country}
        </div>
      </div>

      <div style={{ opacity: vibeOp, display: 'flex', gap: 10, marginTop: 35, flexWrap: 'wrap', justifyContent: 'center', padding: '0 40px' }}>
        {vibes.slice(0, 4).map((vibe, i) => (
          <div key={i} style={{
            fontFamily: 'Inter, sans-serif', fontSize: 14, color: C.gold,
            border: `1px solid ${C.gold}40`, borderRadius: 20, padding: '7px 18px',
            backgroundColor: C.goldLight, letterSpacing: 1.5, textTransform: 'uppercase',
          }}>{vibe}</div>
        ))}
      </div>

      {evalScore && (
        <div style={{ transform: `scale(${scoreScale})`, marginTop: 45, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 44, fontWeight: 700, color: evalScore >= 85 ? '#4ecdc4' : C.gold }}>{evalScore}/100</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: C.dim, letterSpacing: 4, textTransform: 'uppercase', marginTop: 4 }}>Quality Score</div>
        </div>
      )}
    </AbsoluteFill>
  )
}

// ─── Venue Slide (supports video clip OR photo) ──────────────

function VenueSlide({ slide, index, caption }: {
  slide: ReelProps['slides'][0]; index: number; caption?: string
}) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.12], { extrapolateRight: 'clamp' })
  const textY = interpolate(frame, [8, 22], [30, 0], { extrapolateRight: 'clamp' })
  const textOp = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: 'clamp' })
  const badgeScale = spring({ frame: frame - 18, fps, config: { damping: 10 } })
  // Caption fade in
  const captionOp = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' })

  const icons: Record<string, string> = { activity: '🏛', food: '🍽', hotel: '🏨' }
  const isVideo = slide.videoClipUrl && !slide.videoClipUrl.endsWith('.jpg')

  return (
    <AbsoluteFill>
      {/* Background: video clip or photo with Ken Burns */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {isVideo ? (
          <OffthreadVideo src={slide.videoClipUrl!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={slide.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }} />
        )}
        {/* Gradient overlay */}
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,8,12,0) 30%, rgba(8,8,12,0.7) 65%, rgba(8,8,12,0.95) 100%)' }} />
        {/* Top vignette */}
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,8,12,0.4) 0%, transparent 25%)' }} />
      </AbsoluteFill>

      {/* Slide number */}
      <div style={{ position: 'absolute', top: 50, left: 36, fontFamily: 'Georgia, serif', fontSize: 16, color: C.gold, opacity: 0.5 }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Content */}
      <div style={{ position: 'absolute', bottom: 140, left: 36, right: 36, transform: `translateY(${textY}px)`, opacity: textOp }}>
        <div style={{ fontSize: 26, marginBottom: 10 }}>{icons[slide.category] || '📍'}</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 600, color: C.text, lineHeight: 1.15, marginBottom: 10 }}>{slide.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {slide.price && (
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, color: C.gold, fontWeight: 600 }}>
              {slide.price === 'Free' || slide.price === '$0' ? 'Free' : slide.price}
            </div>
          )}
          {slide.rating && (
            <div style={{ transform: `scale(${badgeScale})`, fontFamily: 'Inter, sans-serif', fontSize: 14, color: C.text, backgroundColor: 'rgba(200,164,78,0.2)', border: `1px solid ${C.gold}50`, borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>
              ★ {slide.rating}
            </div>
          )}
        </div>

        {/* Voiceover caption / subtitle */}
        {caption && (
          <div style={{
            opacity: captionOp, marginTop: 16, fontFamily: 'Inter, sans-serif', fontSize: 15,
            color: C.text, backgroundColor: 'rgba(0,0,0,0.6)', padding: '8px 14px',
            borderRadius: 8, lineHeight: 1.5, maxWidth: '90%',
          }}>
            {caption}
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}

// ─── CTA Slide ───────────────────────────────────────────────

function CtaSlide({ destination }: { destination: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const textOp = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })
  const btnScale = spring({ frame: frame - 18, fps, config: { damping: 12 } })
  const logoOp = interpolate(frame, [25, 38], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,164,78,0.05) 0%, transparent 70%)', top: '35%', left: '50%', transform: 'translate(-50%, -50%)' }} />

      <div style={{ opacity: textOp, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, color: C.muted, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 16 }}>Plan this trip</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 50, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{destination}</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: C.muted, marginTop: 10 }}>in 30 seconds</div>
      </div>

      <div style={{ transform: `scale(${btnScale})`, marginTop: 45, backgroundColor: C.gold, borderRadius: 14, padding: '16px 44px' }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 700, color: C.bg, letterSpacing: 1 }}>driftntravel.com</div>
      </div>

      <div style={{ opacity: logoOp, marginTop: 35, fontFamily: 'Georgia, serif', fontSize: 22, color: C.gold, letterSpacing: 5 }}>DRIFT</div>
      <div style={{ opacity: logoOp, marginTop: 6, fontFamily: 'Inter, sans-serif', fontSize: 10, color: C.dim, letterSpacing: 3 }}>EVERY PLACE VERIFIED ON GOOGLE MAPS</div>
    </AbsoluteFill>
  )
}

// ─── Main Composition ────────────────────────────────────────

export const DriftReel: React.FC<ReelProps> = ({
  destination, country, vibes, evalScore, slides, voiceoverUrl, musicUrl, captions, ctaUrl,
}) => {
  const { fps } = useVideoConfig()
  const introDur = 3 * fps
  const slideDur = 3 * fps
  const ctaDur = 3 * fps

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {/* Background music — lower volume */}
      {musicUrl && (
        <Audio src={musicUrl.startsWith('/') ? staticFile(musicUrl) : musicUrl} volume={0.15} />
      )}

      {/* Voiceover — full volume */}
      {voiceoverUrl && (
        <Audio src={voiceoverUrl.startsWith('/') ? staticFile(voiceoverUrl) : voiceoverUrl} volume={0.9} />
      )}

      {/* Intro */}
      <Sequence from={0} durationInFrames={introDur}>
        <IntroSlide destination={destination} country={country} vibes={vibes} evalScore={evalScore} />
      </Sequence>

      {/* Venue slides */}
      {slides.map((slide, i) => (
        <Sequence key={i} from={introDur + i * slideDur} durationInFrames={slideDur}>
          <VenueSlide slide={slide} index={i} caption={captions?.[i + 1]} />
        </Sequence>
      ))}

      {/* CTA */}
      <Sequence from={introDur + slides.length * slideDur} durationInFrames={ctaDur}>
        <CtaSlide destination={destination} />
      </Sequence>
    </AbsoluteFill>
  )
}

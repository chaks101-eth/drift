export interface ReelSlide {
  name: string
  category: string
  price: string
  rating?: number
  imageUrl: string
  videoClipUrl?: string    // AI-generated video clip from photo
  description?: string
  voiceoverText?: string
}

export interface ReelProps {
  destination: string
  country: string
  vibes: string[]
  evalScore?: number
  slides: ReelSlide[]
  voiceoverUrl?: string    // ElevenLabs narration audio
  musicUrl?: string        // Background music
  captions?: string[]      // Subtitle text per sequence (intro, slide1, slide2..., cta)
  ctaUrl?: string
}

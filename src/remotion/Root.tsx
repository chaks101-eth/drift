import React from 'react'
import { Composition } from 'remotion'
import { DriftReel } from './components/DriftReel'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DriftReelAny = DriftReel as any

const defaultProps: Record<string, unknown> = {
  destination: 'Colombo & Galle',
  country: 'Sri Lanka',
  vibes: ['culture', 'foodie', 'beach'],
  evalScore: 97,
  slides: [
    { name: 'Gangaramaya Temple', category: 'activity', price: '$2', rating: 4.6, imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/AHVAweqRxomP35Bdk0BrUXwc7lYla7FhrdXt9-dR4SR3AMj8xt0RfrEvCTXPwNmh3dkezGr5bRgIQiN5lUpkkX2suIC0h88i8PDtadF6gIIddOQCUT-Rd2kDCxfGokGPdOD8Q47j5oil=s1600-w800', description: 'Stunning lakeside temple' },
    { name: 'Ministry of Crab', category: 'food', price: '$40', rating: 4.4, imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwepNvR4UAwDqiDCnKYGhcZiVLZNy0mJ0cEa87bSDRBSTn_KU-9MO11hCwkkIQ22hPxclf1S5MHyMEYAJgZqUZc7mzs35-94Ew6_l5VHkwxAISWfBn0DEASdReW915wk-HDWpikp8=s1600-w800', description: 'Legendary Sri Lankan seafood' },
    { name: 'Galle Face Green', category: 'activity', price: 'Free', rating: 4.5, imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwers9NUBZF_ScsAuOqN3dS3tI-6jsWHg7Gy2D5Nb5CxYqnZR7N_zeoClLzW-7l33XIAt7ciz56WQpbjwiwLUG5ZPbyra4vkh4p-T-ki43ONUDSlLgdjcyEdELYA4eeuZQ8Y7eps=s1600-w719', description: 'Sunset by the ocean' },
    { name: 'Viharamahadevi Park', category: 'activity', price: 'Free', rating: 4.4, imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/AHVAwer858Dk0Pz1vHyyfmlBG873nTBuoivzDsfRFHEquEwgVMacYsvovDtmo5nVe_R5PoYDsZNhSkDOeTDxQVmzu9HnDKpPWbqq0l2lTIkOq8kPecU1zWVuu9KWYaXAVUef9srBv1s=s1600-w800', description: "Colombo's green heart" },
  ],
  ctaUrl: 'https://driftntravel.com',
}

export const RemotionRoot: React.FC = () => {
  const fps = 30
  const slidesCount = (defaultProps.slides as Array<unknown>).length
  const totalDuration = (3 + slidesCount * 3 + 3) * fps // intro + slides + cta

  return (
    <>
      <Composition
        id="DriftReel"
        component={DriftReelAny}
        durationInFrames={totalDuration}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
      />
      <Composition
        id="DriftReelLandscape"
        component={DriftReelAny}
        durationInFrames={totalDuration}
        fps={fps}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
      />
    </>
  )
}

'use client'

import BackButton from './BackButton'

interface StepHeaderProps {
  step: number
  totalSteps?: number
  backHref?: string
  onBack?: () => void
}

export default function StepHeader({ backHref, onBack }: StepHeaderProps) {
  return (
    <div className="mb-8 flex items-center">
      <BackButton href={backHref} onClick={onBack} />
    </div>
  )
}

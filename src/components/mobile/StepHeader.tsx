'use client'

import BackButton from './BackButton'

interface StepHeaderProps {
  step: number
  totalSteps?: number
  backHref?: string
  onBack?: () => void
}

export default function StepHeader({ step, totalSteps = 4, backHref, onBack }: StepHeaderProps) {
  return (
    <div className="mb-12 flex items-center justify-between">
      <BackButton href={backHref} onClick={onBack} />
      <span className="text-[13px] font-medium tabular-nums text-drift-text4">
        {String(step).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
      </span>
    </div>
  )
}

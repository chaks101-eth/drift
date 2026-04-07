'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Old budget page — redirect to new combined details page
export default function BudgetRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/m/plan/details')
  }, [router])
  return (
    <div className="flex h-full items-center justify-center bg-drift-bg">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-drift-border2 border-t-drift-gold" />
    </div>
  )
}

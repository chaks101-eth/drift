import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ — Drift',
  description: 'Frequently asked questions about Drift — AI-powered travel planning.',
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

'use client'

import Link from 'next/link'
import { useState } from 'react'

const faqs = [
  {
    q: 'Is Drift free?',
    a: 'Yes, Drift is free during early access. We may introduce premium features later, but the core experience will always help you plan great trips without paying a thing.',
  },
  {
    q: 'Does Drift book flights and hotels?',
    a: "Drift finds the best options and gives you direct booking links. We don't process bookings ourselves, so you always get the best price directly from the airline or hotel — no middleman markup.",
  },
  {
    q: 'How does the AI work?',
    a: "Drift uses real data from Google Maps, Amadeus flights, and curated destination catalogs. The AI analyzes distances, opening hours, crowd patterns, and your vibes to build trips that actually make sense — not generic lists copy-pasted from a blog.",
  },
  {
    q: 'Can I edit my trip after it\u2019s generated?',
    a: "Absolutely. Tap any item to see alternatives, use the chat to ask for changes (\"make day 2 more relaxed\" or \"swap the hotel for something cheaper\"), or remix the whole trip with new vibes. Your trip is alive, not static.",
  },
  {
    q: 'What data do you collect?',
    a: "Email for your account, trip preferences, and chat messages to improve recommendations. We don\u2019t sell your data to anyone. See our Privacy Policy for the full details.",
  },
  {
    q: 'Is my trip data private?',
    a: 'Yes. Your trips are only visible to you unless you explicitly share them. Shared trips generate a read-only link — no one can edit your itinerary through a share link.',
  },
  {
    q: 'Which destinations are available?',
    a: "We\u2019re adding new destinations regularly through our curated catalog pipeline. Currently available destinations are shown on the destinations page after you pick your vibes. If your dream destination isn\u2019t there yet, let us know.",
  },
  {
    q: 'Can I use Drift on desktop?',
    a: 'Drift is designed mobile-first but works beautifully on any device. The trip board, chat, and all features are fully functional on desktop — the best experience is on your phone, but desktop works great for longer planning sessions.',
  },
  {
    q: 'How do I delete my account?',
    a: "Email privacy@drifttravel.app and we\u2019ll delete your account and all associated data. No hoops, no retention tricks.",
  },
  {
    q: 'I found a bug or have feedback',
    a: "Email hello@drifttravel.app — we read everything. Bug reports, feature requests, destination suggestions, or just telling us about a great trip you planned. All welcome.",
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-[rgba(255,255,255,0.06)] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left bg-transparent border-none cursor-pointer group"
      >
        <span className="text-[15px] font-medium text-[#f0efe8] group-hover:text-[#c8a44e] transition-colors">
          {q}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c8a44e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
        }}
      >
        <div className="overflow-hidden">
          <p className="text-[13px] text-[#7a7a85] leading-[1.8] pb-5 pr-8">
            {a}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(200,164,78,0.05) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(78,130,200,0.03) 0%, transparent 50%)',
        }}
      />

      {/* Nav back */}
      <nav className="relative z-10 px-8 py-5 max-md:px-4">
        <Link
          href="/"
          className="font-serif text-xl font-semibold text-[#c8a44e] transition-all hover:opacity-80"
        >
          Drift
        </Link>
      </nav>

      <main className="relative z-10 max-w-[720px] mx-auto px-8 pb-24 max-md:px-4">
        {/* Header */}
        <section className="pt-16 pb-14 max-md:pt-10 max-md:pb-10">
          <p className="text-[10px] tracking-[4px] uppercase text-[#c8a44e] font-semibold mb-3">
            FAQ
          </p>
          <h1 className="font-serif text-[clamp(30px,5vw,48px)] font-normal leading-[1.2] mb-4">
            Frequently asked <em className="text-[#c8a44e] italic">questions</em>
          </h1>
          <p className="text-[15px] text-[#7a7a85] leading-[1.8] max-w-[480px]">
            Everything you need to know about Drift. Can&apos;t find what you&apos;re
            looking for?{' '}
            <a
              href="mailto:hello@drifttravel.app"
              className="text-[#c8a44e] hover:underline"
            >
              Reach out
            </a>
            .
          </p>
        </section>

        {/* FAQ list */}
        <section className="rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-6 max-md:px-4">
          {faqs.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </section>

        {/* Footer links */}
        <section className="mt-16 pt-8 border-t border-[rgba(255,255,255,0.06)]">
          <div className="flex gap-6 text-[12px] text-[#4a4a55]">
            <Link href="/about" className="transition-all hover:text-[#7a7a85]">
              About
            </Link>
            <Link href="/privacy" className="transition-all hover:text-[#7a7a85]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-all hover:text-[#7a7a85]">
              Terms of Service
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

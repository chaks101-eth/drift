import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About — Drift',
  description: 'Built for travelers who care about the details. Real data, real prices, AI that understands vibes.',
}

export default function AboutPage() {
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
        {/* Hero */}
        <section className="pt-16 pb-20 max-md:pt-10 max-md:pb-14">
          <p className="text-[10px] tracking-[4px] uppercase text-[#c8a44e] font-semibold mb-3">
            About Drift
          </p>
          <h1 className="font-serif text-[clamp(30px,5vw,48px)] font-normal leading-[1.2] mb-5">
            Built for travelers who care about the{' '}
            <em className="text-[#c8a44e] italic">details</em>
          </h1>
          <p className="text-[15px] text-[#7a7a85] leading-[1.8] max-w-[560px]">
            Most trip planners give you a generic list and call it a day. Drift
            is different. We use real flight prices, real reviews, and real
            opening hours to build trips that actually work — then let you
            reshape them with a conversation, not a spreadsheet.
          </p>
        </section>

        {/* Mission */}
        <section className="pb-16 max-md:pb-12">
          <h2 className="font-serif text-[clamp(22px,3.5vw,32px)] font-normal leading-[1.3] mb-4">
            AI that understands <em className="text-[#c8a44e] italic">vibes</em>, not just logistics
          </h2>
          <p className="text-[14px] text-[#7a7a85] leading-[1.8]">
            You don&apos;t plan a trip by star rating. You say &ldquo;romantic +
            foodie + beach&rdquo; and expect something that feels like you. Drift&apos;s
            AI scores every hotel, restaurant, and activity against your vibes, then
            explains why it picked each one. No black boxes. No generic top-10 lists.
            Just travel that makes sense for the way you actually travel.
          </p>
        </section>

        {/* How it works */}
        <section className="pb-16 max-md:pb-12">
          <p className="text-[10px] tracking-[4px] uppercase text-[#c8a44e] font-semibold mb-3">
            How it works
          </p>
          <h2 className="font-serif text-[clamp(22px,3.5vw,32px)] font-normal leading-[1.3] mb-6">
            Three steps. No planning headaches.
          </h2>
          <div className="space-y-5">
            {[
              {
                num: '1',
                title: 'Pick your vibes',
                desc: 'Choose up to 3 moods — beach chill, culture deep dive, foodie trail, adventure rush. Set your budget and dates.',
              },
              {
                num: '2',
                title: 'AI builds with real data',
                desc: 'Live flight prices from Amadeus. Hotels and restaurants scored from millions of reviews. Crowd-optimized timings and distances that make sense.',
              },
              {
                num: '3',
                title: 'Customize with a conversation',
                desc: 'Swap any item with one tap. Ask the AI to adjust. Remix the whole trip with new vibes. Book when you\'re ready.',
              },
            ].map((step) => (
              <div
                key={step.num}
                className="flex gap-4 p-5 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)]"
              >
                <div className="w-8 h-8 rounded-full border border-[rgba(200,164,78,0.25)] bg-[rgba(200,164,78,0.06)] flex items-center justify-center text-sm text-[#c8a44e] font-semibold font-serif flex-shrink-0 mt-0.5">
                  {step.num}
                </div>
                <div>
                  <div className="text-[14px] font-semibold mb-1">{step.title}</div>
                  <div className="text-[13px] text-[#7a7a85] leading-relaxed">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What makes Drift different */}
        <section className="pb-16 max-md:pb-12">
          <p className="text-[10px] tracking-[4px] uppercase text-[#c8a44e] font-semibold mb-3">
            What makes Drift different
          </p>
          <h2 className="font-serif text-[clamp(22px,3.5vw,32px)] font-normal leading-[1.3] mb-6">
            Built different, <em className="text-[#c8a44e] italic">on purpose</em>
          </h2>
          <div className="space-y-4">
            {[
              {
                title: 'Real prices, real reviews',
                desc: 'Flight prices from Amadeus. Restaurant and hotel data from Google Maps with millions of reviews. Not an LLM making up numbers.',
              },
              {
                title: 'AI that explains itself',
                desc: 'Every recommendation shows why it was picked — vibe alignment, price-to-comfort ratio, crowd timing. You see the reasoning, not just the result.',
              },
              {
                title: 'Swap, don\'t start over',
                desc: 'Don\'t like a hotel? Tap to see alternatives, compare trust badges, swap in one click. The rest of your trip stays intact.',
              },
              {
                title: 'Trip intelligence',
                desc: 'Drift knows distances between venues, opening hours, best times to visit, and how long you\'ll need. Your itinerary isn\'t just a list — it\'s a plan that works.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-5 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] transition-all duration-300 hover:border-[rgba(200,164,78,0.1)]"
              >
                <div className="text-[14px] font-semibold mb-1.5">{item.title}</div>
                <div className="text-[13px] text-[#7a7a85] leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="pb-16 max-md:pb-12">
          <p className="text-[10px] tracking-[4px] uppercase text-[#c8a44e] font-semibold mb-3">
            Get in touch
          </p>
          <h2 className="font-serif text-[clamp(22px,3.5vw,32px)] font-normal leading-[1.3] mb-4">
            We&apos;d love to hear from you
          </h2>
          <p className="text-[14px] text-[#7a7a85] leading-[1.8] mb-6">
            Questions, feedback, partnership inquiries — we read everything.
          </p>
          <a
            href="mailto:hello@drifttravel.app"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[rgba(200,164,78,0.25)] text-[#c8a44e] text-sm font-medium transition-all hover:bg-[rgba(200,164,78,0.06)] hover:-translate-y-0.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            hello@drifttravel.app
          </a>
        </section>

        {/* Legal links */}
        <section className="pt-8 border-t border-[rgba(255,255,255,0.06)]">
          <div className="flex gap-6 text-[12px] text-[#4a4a55]">
            <Link href="/faq" className="transition-all hover:text-[#7a7a85]">
              FAQ
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

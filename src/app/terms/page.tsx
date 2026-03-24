import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Drift',
  description: 'Terms and conditions for using the Drift travel planning service.',
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* Header */}
      <header className="border-b border-[rgba(255,255,255,0.06)]">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="font-serif text-lg text-[#c8a44e] hover:opacity-80 transition-opacity">
            Drift
          </Link>
          <Link href="/privacy" className="text-xs text-[#7a7a85] hover:text-[#c8a44e] transition-colors">
            Privacy Policy
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-[10px] tracking-[4px] uppercase text-[#c8a44e] font-semibold mb-3">Legal</p>
        <h1 className="font-serif text-[clamp(32px,5vw,48px)] font-normal leading-[1.15] mb-3">
          Terms of <em className="text-[#c8a44e] italic">Service</em>
        </h1>
        <p className="text-sm text-[#4a4a55] mb-12">Last updated: March 2026</p>

        <div className="space-y-10 text-[14px] leading-[1.8] text-[#a0a0aa]">

          <Section title="1. Service Description">
            <p>
              Drift is an AI-powered travel planning platform that generates personalized trip itineraries based on your preferences. Drift is a <strong className="text-[#f0efe8]">planning tool, not a travel agency or booking agent</strong>. We help you discover and organize travel options — flights, hotels, activities, and restaurants — but we do not process bookings, handle payments for travel services, or guarantee availability.
            </p>
          </Section>

          <Section title="2. Acceptance of Terms">
            <p>
              By accessing or using Drift, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the service. We may update these terms from time to time, and your continued use constitutes acceptance of any changes.
            </p>
          </Section>

          <Section title="3. Account Responsibility">
            <p>
              You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account. You must provide a valid email address to create an account. You agree to:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Provide accurate and current information</li>
              <li>Not share your account or login credentials with others</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to use Drift to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Scrape, crawl, or extract data from the service through automated means</li>
              <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
              <li>Use the AI chat to generate content unrelated to travel planning</li>
              <li>Interfere with or disrupt the service or its infrastructure</li>
              <li>Reverse engineer, decompile, or disassemble any part of the service</li>
              <li>Use the service to compete with or replicate Drift&apos;s core functionality</li>
            </ul>
          </Section>

          <Section title="5. AI-Generated Content Disclaimer">
            <p>
              Drift uses artificial intelligence to generate trip itineraries, recommendations, and chat responses. While we strive for accuracy, AI-generated content is provided <strong className="text-[#f0efe8]">as suggestions only, not guarantees</strong>. Specifically:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Itineraries are algorithmically generated recommendations, not confirmed reservations.</li>
              <li>Ratings, reviews, and descriptions are sourced from third-party data and may be outdated or inaccurate.</li>
              <li>Travel timings, distances, and logistics are estimates and should be independently verified.</li>
              <li>AI chat responses may occasionally contain inaccuracies. Always verify critical travel information through official sources.</li>
            </ul>
            <p className="mt-3">
              You are solely responsible for verifying all travel details, making informed booking decisions, and ensuring your travel plans meet your needs.
            </p>
          </Section>

          <Section title="6. Booking and Pricing Disclaimer">
            <p>
              Drift may display flight prices, hotel rates, and activity costs sourced from third-party APIs (such as Amadeus). These prices are:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong className="text-[#f0efe8]">Indicative only</strong> — actual prices may differ when you visit the booking provider.</li>
              <li><strong className="text-[#f0efe8]">Subject to change</strong> — availability and pricing fluctuate in real time.</li>
              <li><strong className="text-[#f0efe8]">Not guaranteed</strong> — Drift does not hold inventory or lock prices.</li>
            </ul>
            <p className="mt-3">
              When you click a booking link, you will be redirected to a third-party provider (e.g., Skyscanner, hotel websites). Any transaction you complete is solely between you and that provider. Drift is not a party to any booking transaction and bears no liability for bookings made through external links.
            </p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              The Drift name, logo, design system, and all original content on the platform are the intellectual property of Drift. You may not reproduce, distribute, or create derivative works from our branding or platform without written permission.
            </p>
            <p className="mt-3">
              Trip itineraries generated for you are yours to keep, share, and use for personal travel planning. However, the underlying algorithms, prompts, data pipelines, and catalog data remain our property.
            </p>
          </Section>

          <Section title="8. User-Generated Content">
            <p>
              By using the AI chat feature, you grant Drift a non-exclusive, royalty-free license to process your messages for the purpose of generating trip recommendations. We do not use your chat messages for marketing, sell them to third parties, or use them to train AI models.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Drift and its operators shall not be liable for:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, data, or business opportunities</li>
              <li>Damages arising from travel decisions made based on AI-generated suggestions</li>
              <li>Third-party service outages, booking errors, or pricing discrepancies</li>
              <li>Any losses exceeding the amount you paid to Drift in the 12 months prior to the claim (if applicable)</li>
            </ul>
            <p className="mt-3">
              The service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.
            </p>
          </Section>

          <Section title="10. Termination">
            <p>
              We reserve the right to suspend or terminate your account at our discretion if you violate these terms or engage in conduct that is harmful to other users or the service. You may delete your account at any time, which will remove your personal data as described in our{' '}
              <Link href="/privacy" className="text-[#c8a44e] hover:underline">Privacy Policy</Link>.
            </p>
            <p className="mt-3">
              Upon termination, your right to access the service ceases immediately. Sections relating to intellectual property, limitation of liability, and dispute resolution survive termination.
            </p>
          </Section>

          <Section title="11. Changes to These Terms">
            <p>
              We may revise these Terms of Service at any time by updating this page. Material changes will be reflected in the &quot;Last updated&quot; date. Your continued use of Drift after changes are posted constitutes your acceptance of the revised terms.
            </p>
          </Section>

          <Section title="12. Governing Law">
            <p>
              These terms shall be governed by and construed in accordance with applicable law. Any disputes arising from these terms or your use of Drift shall be resolved through good-faith negotiation before pursuing formal legal action.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>
              If you have questions about these Terms of Service, contact us at:
            </p>
            <p className="mt-2">
              <a href="mailto:legal@drifttravel.app" className="text-[#c8a44e] hover:underline">legal@drifttravel.app</a>
            </p>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.06)] text-center px-6 py-6 text-[11px] text-[#4a4a55]">
        <Link href="/" className="hover:text-[#c8a44e] transition-colors">Drift</Link>
        {' '}&middot;{' '}
        <Link href="/privacy" className="hover:text-[#c8a44e] transition-colors">Privacy</Link>
        {' '}&middot;{' '}
        <span className="text-[#7a7a85]">Terms</span>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[#f0efe8] font-semibold text-base mb-3">{title}</h3>
      {children}
    </section>
  )
}

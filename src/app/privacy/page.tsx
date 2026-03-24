import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Drift',
  description: 'How Drift collects, uses, and protects your data.',
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* Header */}
      <header className="border-b border-[rgba(255,255,255,0.06)]">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="font-serif text-lg text-[#c8a44e] hover:opacity-80 transition-opacity">
            Drift
          </Link>
          <Link href="/terms" className="text-xs text-[#7a7a85] hover:text-[#c8a44e] transition-colors">
            Terms of Service
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-[10px] tracking-[4px] uppercase text-[#c8a44e] font-semibold mb-3">Legal</p>
        <h1 className="font-serif text-[clamp(32px,5vw,48px)] font-normal leading-[1.15] mb-3">
          Privacy <em className="text-[#c8a44e] italic">Policy</em>
        </h1>
        <p className="text-sm text-[#4a4a55] mb-12">Last updated: March 2026</p>

        <div className="space-y-10 text-[14px] leading-[1.8] text-[#a0a0aa]">

          <Section title="1. Introduction">
            <p>
              Drift (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is an AI-powered travel planning service. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services. By using Drift, you agree to the practices described in this policy.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <h4 className="text-[#f0efe8] font-semibold text-[13px] mt-4 mb-1.5">Account Information</h4>
            <p>
              When you create an account, we collect your email address through our authentication provider. We do not collect passwords directly — authentication is handled securely by Supabase.
            </p>

            <h4 className="text-[#f0efe8] font-semibold text-[13px] mt-4 mb-1.5">Trip Data</h4>
            <p>
              When you plan a trip, we store your travel preferences including selected destinations, vibes (travel style preferences), budget tier, travel dates, origin city, and generated itinerary items such as flights, hotels, activities, and restaurants.
            </p>

            <h4 className="text-[#f0efe8] font-semibold text-[13px] mt-4 mb-1.5">Chat Messages</h4>
            <p>
              When you interact with our AI assistant, we store your chat messages and AI responses to provide context-aware trip planning within each trip.
            </p>

            <h4 className="text-[#f0efe8] font-semibold text-[13px] mt-4 mb-1.5">Usage Analytics</h4>
            <p>
              We collect anonymized usage data through Google Analytics (GA4), including pages visited, feature interactions, device type, and general geographic region. This data helps us improve the product experience.
            </p>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-2">
              <li>Generate personalized trip itineraries based on your preferences</li>
              <li>Power AI chat conversations to refine and adjust your trips</li>
              <li>Search for real-time flight prices and availability</li>
              <li>Retrieve destination data including hotels, activities, and restaurants</li>
              <li>Analyze usage patterns to improve our product and fix issues</li>
              <li>Send transactional emails related to your account (e.g., magic link login)</li>
            </ul>
          </Section>

          <Section title="4. Third-Party Services">
            <p>We share limited data with the following services to provide our core functionality:</p>

            <ul className="mt-3 space-y-3">
              <li>
                <strong className="text-[#f0efe8]">Supabase</strong> — Database hosting and user authentication. Stores your account, trip data, and chat messages. <a href="https://supabase.com/privacy" className="text-[#c8a44e] hover:underline" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a>
              </li>
              <li>
                <strong className="text-[#f0efe8]">Google Gemini AI</strong> — Processes your trip preferences and chat messages to generate itineraries and respond to queries. Data is sent per-request and not stored by the AI model. <a href="https://ai.google.dev/terms" className="text-[#c8a44e] hover:underline" target="_blank" rel="noopener noreferrer">Google AI Terms</a>
              </li>
              <li>
                <strong className="text-[#f0efe8]">Amadeus</strong> — Receives origin, destination, and date information to search for real-time flight prices and hotel availability. <a href="https://developers.amadeus.com/legal" className="text-[#c8a44e] hover:underline" target="_blank" rel="noopener noreferrer">Amadeus Privacy Policy</a>
              </li>
              <li>
                <strong className="text-[#f0efe8]">SerpAPI</strong> — Retrieves Google Maps place data (ratings, reviews, photos) for destinations in our catalog. This is used during catalog building, not during live user sessions. <a href="https://serpapi.com/legal" className="text-[#c8a44e] hover:underline" target="_blank" rel="noopener noreferrer">SerpAPI Terms</a>
              </li>
              <li>
                <strong className="text-[#f0efe8]">Google Analytics (GA4)</strong> — Collects anonymized usage data to help us understand how people use Drift. <a href="https://policies.google.com/privacy" className="text-[#c8a44e] hover:underline" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>
              </li>
            </ul>
          </Section>

          <Section title="5. Cookies and Local Storage">
            <p>Drift uses a minimal set of cookies and browser storage:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong className="text-[#f0efe8]">Authentication session</strong> — Supabase sets secure cookies to maintain your login session.</li>
              <li><strong className="text-[#f0efe8]">Google Analytics</strong> — GA4 sets cookies to distinguish unique visitors and track sessions.</li>
              <li><strong className="text-[#f0efe8]">Local storage</strong> — We store UI preferences (e.g., onboarding completion status) in your browser&apos;s local storage. This data never leaves your device.</li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <ul className="list-disc pl-5 space-y-2">
              <li>Your trip data and itineraries are stored until you delete them from your account.</li>
              <li>Chat messages are stored per trip and deleted when the associated trip is deleted.</li>
              <li>Your account information is retained until you request account deletion.</li>
              <li>Analytics data is retained according to Google Analytics&apos; standard retention settings (14 months).</li>
            </ul>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong className="text-[#f0efe8]">Access</strong> your data — view all trips, itineraries, and chat messages through your account.</li>
              <li><strong className="text-[#f0efe8]">Delete</strong> your data — remove individual trips or request full account deletion.</li>
              <li><strong className="text-[#f0efe8]">Export</strong> your data — request a copy of your trip data via email.</li>
              <li><strong className="text-[#f0efe8]">Withdraw consent</strong> — stop using the service at any time; delete your account to remove all stored data.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@drifttravel.app" className="text-[#c8a44e] hover:underline">privacy@drifttravel.app</a>.
            </p>
          </Section>

          <Section title="8. Data Security">
            <p>
              We implement industry-standard security measures to protect your data. All data is transmitted over HTTPS. Database access is restricted and authenticated. However, no method of electronic storage or transmission is 100% secure, and we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>
              Drift is not intended for users under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by updating the &quot;Last updated&quot; date at the top of this page. Your continued use of Drift after changes are posted constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              If you have questions or concerns about this Privacy Policy or your data, contact us at:
            </p>
            <p className="mt-2">
              <a href="mailto:privacy@drifttravel.app" className="text-[#c8a44e] hover:underline">privacy@drifttravel.app</a>
            </p>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.06)] text-center px-6 py-6 text-[11px] text-[#4a4a55]">
        <Link href="/" className="hover:text-[#c8a44e] transition-colors">Drift</Link>
        {' '}&middot;{' '}
        <span className="text-[#7a7a85]">Privacy</span>
        {' '}&middot;{' '}
        <Link href="/terms" className="hover:text-[#c8a44e] transition-colors">Terms</Link>
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

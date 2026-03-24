import type { Metadata, Viewport } from "next"
import Analytics from "./analytics"
import "./globals.css"

export const metadata: Metadata = {
  title: "Drift — Just Drift.",
  description: "AI-powered travel planning. Tell us your vibe, budget, and dates — we build the perfect trip in minutes. Real flights. Real hotels. Real AI.",
  metadataBase: new URL("https://drift.travel"),
  openGraph: {
    title: "Drift — Just Drift.",
    description: "AI-powered travel planning. Tell us your vibe, budget, and dates — we build the perfect trip in minutes.",
    url: "https://drift.travel",
    siteName: "Drift",
    type: "website",
    images: [{ url: "/assets/og-image.png", width: 1200, height: 630, alt: "Drift — AI Travel Planner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Drift — Just Drift.",
    description: "AI-powered travel planning. Travel that feels like you.",
    images: ["/assets/og-image.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/favicon-32.png",
    apple: "/assets/icon-192.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#08080c",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Analytics />
        {children}
      </body>
    </html>
  )
}

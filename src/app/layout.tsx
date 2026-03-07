import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Drift — Just Drift.",
  description: "AI-powered travel planning. Travel that feels like you.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}

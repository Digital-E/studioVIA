import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Studio VIA',
  description: 'Architecture Practice Zürich',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/favicon.png',
  },
}

// suppressHydrationWarning prevents React from warning about the `lang`
// attribute being set client-side by the LocaleHtml component in [locale]/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}

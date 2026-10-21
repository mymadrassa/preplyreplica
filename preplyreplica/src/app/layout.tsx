// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/layout.tsx
import type { Metadata } from 'next'
import { Amiri_Quran } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ToastProvider'

// Exposed as --font-quran, which the Mushaf package's page renderer reads.
const quranFont = Amiri_Quran({ weight: '400', subsets: ['arabic'], variable: '--font-quran', display: 'swap' })

export const metadata: Metadata = {
  title: 'Preply Clone',
  description: 'A tutor marketplace built with Next.js, Supabase, Stripe, and Jitsi.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${quranFont.variable} min-h-screen bg-muted-50 text-slate-900 antialiased`}>
        <ToastProvider>
          <div className="min-h-screen bg-muted-50">{children}</div>
        </ToastProvider>
      </body>
    </html>
  )
}

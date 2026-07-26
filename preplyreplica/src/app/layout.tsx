// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Preply Clone',
  description: 'A tutor marketplace built with Next.js, Supabase, Stripe, and Jitsi.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-muted-50 text-slate-900 antialiased">
        <Navbar />
        <div className="min-h-screen bg-muted-50">{children}</div>
      </body>
    </html>
  )
}

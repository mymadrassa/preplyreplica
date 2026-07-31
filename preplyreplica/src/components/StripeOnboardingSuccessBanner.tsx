'use client'

import { useEffect } from 'react'

export function StripeOnboardingSuccessBanner() {
  useEffect(() => {
    // Strip the ?stripe_onboarding=success marker from the URL bar using the
    // native History API (not router.replace, which would trigger Next.js to
    // re-fetch this page's server data immediately and make the banner
    // vanish right away). This way it stays visible for this view, and only
    // a subsequent manual refresh — now loading the clean URL — makes it
    // disappear for good.
    window.history.replaceState(null, '', '/teacher/dashboard')
  }, [])

  return (
    <div className="mb-8 rounded-3xl border border-sky-300 bg-sky-50 p-6">
      <p className="text-sky-900">
        <strong>Stripe setup complete!</strong> Your payout account is ready — once your profile is approved, you'll be able to accept bookings.
      </p>
    </div>
  )
}

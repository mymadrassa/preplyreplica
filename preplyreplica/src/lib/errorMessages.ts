// Supabase (and other providers) return error strings meant for developers,
// not end users -- e.g. "email rate limit exceeded" with no context on what
// that means or what to do. This maps known raw messages to something a
// student/teacher can actually act on; anything unrecognized falls through
// to the raw message rather than being silently swallowed.
const PATTERNS: { test: RegExp; friendly: string }[] = [
  {
    test: /email rate limit exceeded/i,
    friendly: "We've sent too many emails in a short time. Please wait a few minutes and try again.",
  },
  {
    test: /signup.*disabled|email signups are disabled/i,
    friendly: 'New account creation is temporarily unavailable. Please try again later.',
  },
  {
    test: /password.*(at least|should be|too short)/i,
    friendly: 'Your password needs to be at least 8 characters.',
  },
  {
    test: /invalid login credentials/i,
    friendly: 'Incorrect email or password.',
  },
  {
    test: /network|fetch failed|timeout/i,
    friendly: 'We couldn’t reach the server. Check your connection and try again.',
  },
]

export function toFriendlyAuthMessage(raw: string): string {
  const match = PATTERNS.find((pattern) => pattern.test.test(raw))
  return match ? match.friendly : raw
}

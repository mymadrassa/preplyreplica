// Supabase (and other providers) return error strings meant for developers,
// not end users -- e.g. "email rate limit exceeded" with no context on what
// that means or what to do. This maps known raw messages to something a
// student/teacher can actually act on; anything unrecognized falls through
// to the raw message rather than being silently swallowed.
// `status` is the HTTP status a caller should respond with for this raw
// error -- defaults to 400 (the catch-all "bad request" Supabase auth
// errors generally map to) when not specified, except a rate limit, which
// is a 429 (the client did nothing wrong, it just needs to slow down).
const PATTERNS: { test: RegExp; friendly: string; status?: number }[] = [
  {
    // supabase-js wraps some server-side failures (e.g. the auth email
    // provider rejecting a send -- a misconfigured custom SMTP server,
    // for instance) as an AuthRetryableFetchError whose `.message` is
    // literally the empty object "{}", not a usable string. Whatever
    // failed, it's on our infrastructure, not something the user can fix
    // by retyping their email -- a 500 and a "contact support" message is
    // more honest than a 400 that implies they made a mistake.
    test: /^\{\}$|^\s*$/,
    friendly: "Something went wrong on our end while creating your account. Please contact support if this keeps happening.",
    status: 500,
  },
  {
    test: /email rate limit exceeded/i,
    friendly: "We've sent too many emails in a short time. Please wait a few minutes and try again.",
    status: 429,
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

export function toFriendlyAuthError(raw: string): { message: string; status: number } {
  const match = PATTERNS.find((pattern) => pattern.test.test(raw))
  return { message: match ? match.friendly : raw, status: match?.status ?? 400 }
}

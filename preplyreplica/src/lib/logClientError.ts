'use client'

// Fire-and-forget: records a raw error server-side (via /api/errors/log, see
// that route for the service-role write) without blocking or failing the
// caller's own error handling if the log request itself fails.
export function logClientError(context: string, message: string, detail?: string) {
  fetch('/api/errors/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context, message, detail }),
  }).catch(() => {})
}

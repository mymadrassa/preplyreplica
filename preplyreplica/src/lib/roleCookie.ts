// Remembers a user's verified role for a few minutes so the middleware doesn't
// query the database on every page change. The cookie is HMAC-signed with a
// server-only secret and bound to the user id, so it can't be forged, edited,
// or reused by someone else signed in on the same browser. Runs in the Edge
// runtime, so it only uses Web Crypto.

export const ROLE_COOKIE = 'role_check'
export const ROLE_COOKIE_TTL_SECONDS = 300

const encoder = new TextEncoder()

function serverSecret(): string | null {
  return process.env.ROLE_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(new ArrayBuffer(binary.length))
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function importKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** `userId.role.expiresAt.signature`, or null when no secret is configured (caching is then simply off). */
export async function signRoleCookie(userId: string, role: string, now = Date.now(), secret = serverSecret()): Promise<string | null> {
  if (!secret) return null
  const payload = `${userId}.${role}.${Math.floor(now / 1000) + ROLE_COOKIE_TTL_SECONDS}`
  const signature = await crypto.subtle.sign('HMAC', await importKey(secret), encoder.encode(payload))
  return `${payload}.${toBase64Url(signature)}`
}

/** The cached role, if the cookie is genuine, unexpired and belongs to `userId`; otherwise null. */
export async function readRoleCookie(value: string | undefined, userId: string, now = Date.now(), secret = serverSecret()): Promise<string | null> {
  if (!value || !secret) return null
  const parts = value.split('.')
  if (parts.length !== 4) return null

  const [cookieUserId, role, expiresAt, signature] = parts
  if (cookieUserId !== userId) return null
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) <= Math.floor(now / 1000)) return null

  const signatureBytes = fromBase64Url(signature)
  if (!signatureBytes) return null

  const genuine = await crypto.subtle.verify('HMAC', await importKey(secret), signatureBytes, encoder.encode(`${cookieUserId}.${role}.${expiresAt}`))
  return genuine ? role : null
}

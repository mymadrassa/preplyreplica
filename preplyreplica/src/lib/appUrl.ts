/**
 * A full link to a page of the app, for emails and messages: email apps need
 * the whole address (a bare "/teacher/dashboard" doesn't open the site).
 * NEXT_PUBLIC_APP_URL is the site's address, e.g. http://localhost:3000
 * locally and the production URL on Vercel.
 */
export function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/+$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

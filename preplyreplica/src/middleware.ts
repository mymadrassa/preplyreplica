// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/server'
import { ROLE_COOKIE, ROLE_COOKIE_TTL_SECONDS, readRoleCookie, signRoleCookie } from '@/lib/roleCookie'

const roleMap: Record<string, string> = {
  '/student': 'student',
  '/teacher': 'teacher',
  '/admin': 'admin',
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient(request, response)
  const { data: { session } } = await supabase.auth.getSession()

  const pathname = request.nextUrl.pathname
  const prefix = Object.keys(roleMap).find((key) => pathname.startsWith(key))
  if (!prefix) return response

  if (!session?.user?.id) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // A signed cookie remembers the verified role for a few minutes, so most
  // page changes skip the database round trip. It falls back to the query
  // whenever the cookie is missing, expired, tampered with or for another user.
  let role = await readRoleCookie(request.cookies.get(ROLE_COOKIE)?.value, session.user.id)
  if (!role) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    role = profile?.role ?? null
    const signed = role ? await signRoleCookie(session.user.id, role) : null
    if (signed) {
      response.cookies.set(ROLE_COOKIE, signed, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ROLE_COOKIE_TTL_SECONDS,
      })
    }
  }

  if (role !== roleMap[prefix]) {
    return new NextResponse('Access denied', { status: 403 })
  }

  return response
}

export const config = {
  matcher: ['/student/:path*', '/teacher/:path*', '/admin/:path*'],
}

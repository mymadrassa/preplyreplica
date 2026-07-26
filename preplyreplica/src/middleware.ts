// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/server'

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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  const requiredRole = roleMap[prefix]
  if (!profile || profile.role !== requiredRole) {
    return new NextResponse('Access denied', { status: 403 })
  }

  return response
}

export const config = {
  matcher: ['/student/:path*', '/teacher/:path*', '/admin/:path*'],
}

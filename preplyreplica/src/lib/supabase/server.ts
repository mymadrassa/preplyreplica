// src/lib/supabase/server.ts
import { createServerClient as createSsrServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import type { NextRequest, NextResponse } from 'next/server'

export function createSupabaseServerClient() {
  const cookieStore = cookies()

  return createSsrServerClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // called from a Server Component — safe to ignore if you have middleware refreshing sessions
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // same as above
          }
        },
      },
    }
  )
}

export const createClient = createSupabaseServerClient
export const createServerClient = createSupabaseServerClient

export function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  return createSsrServerClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            response.cookies.set({ name, value, ...options })
          } catch {
            // ignore if cookie write is unavailable in this runtime
          }
        },
        remove(name: string, options: any) {
          try {
            response.cookies.set({ name, value: '', ...options })
          } catch {
            // ignore if cookie write is unavailable in this runtime
          }
        },
      },
    }
  )
}

export function createSupabaseServiceRoleClient() {
  return createSupabaseClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

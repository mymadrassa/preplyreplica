// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/lib/supabase/client.ts
import { createBrowserClient as createSsrBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Uses @supabase/ssr's browser client (not plain @supabase/supabase-js) so
// the session is persisted via cookies instead of localStorage — the
// server-side clients (middleware, server components) read the session from
// cookies, so a plain client's sign-in/sign-out never reliably reached them.
export const createBrowserClient = () =>
  createSsrBrowserClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

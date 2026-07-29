// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/lib/supabase/client.ts
import { createBrowserClient as createSsrBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export const createBrowserClient = () =>
  createSsrBrowserClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

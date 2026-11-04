import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { closePackageWithRefund } from '@/lib/packages'

/** The student ends their package: unused lessons are refunded at the discounted per-lesson price. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: pkg } = await supabase.from('lesson_packages').select('*').eq('id', params.id).maybeSingle()
  if (!pkg || pkg.student_id !== userId) {
    return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
  }
  if (pkg.status !== 'active') {
    return NextResponse.json({ error: 'This package can’t be cancelled.' }, { status: 409 })
  }

  const result = await closePackageWithRefund(pkg, 'cancelled')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json(result)
}

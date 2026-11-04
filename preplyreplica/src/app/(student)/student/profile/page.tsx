import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PhoneForm } from './PhoneForm'
import { GENDERS } from '@/lib/gender'

export default async function StudentProfilePage() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('full_name, email, phone, gender').eq('id', userId).single()

  return (
    <main className="container mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-slate-900">Your profile</h1>
      <p className="mt-2 text-slate-600">{profile?.email}</p>
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <PhoneForm initialName={profile?.full_name ?? ''} initialPhone={profile?.phone ?? ''} />
      </div>
      {profile?.gender ? (
        <p className="mt-4 text-sm text-slate-600">
          <span className="font-medium text-slate-900">Gender:</span> {GENDERS.find((g) => g.value === profile.gender)?.label}. You&apos;re matched with teachers of the same gender.{' '}
          <span className="text-slate-400">Contact us to change it.</span>
        </p>
      ) : null}
    </main>
  )
}

import { revalidateTag } from 'next/cache'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { TEACHER_CATALOGUE_TAG } from '@/lib/teacherCatalogue'
import { getPaymentProvider } from './index'

/**
 * Starts or continues a teacher's payout account setup and returns the
 * provider's onboarding link. An existing account stays with the provider
 * that holds it; a new one is opened with the current provider and saved on
 * the teacher's row (with the server key: payment_provider is platform-managed).
 * `persist` is false when the teacher row doesn't exist yet; the caller then
 * saves `accountId` itself and calls savePayoutAccount afterwards.
 */
export async function startPayoutSetup(
  teacher: { id: string; email: string; payout_account_id: string | null; payment_provider: string | null },
  { persist = true }: { persist?: boolean } = {}
): Promise<{ accountId: string; providerId: string; url: string }> {
  const provider = getPaymentProvider(teacher.payout_account_id ? teacher.payment_provider : undefined)
  let accountId = teacher.payout_account_id
  if (!accountId) {
    accountId = (await provider.createPayeeAccount({ email: teacher.email })).accountId
    if (persist) await savePayoutAccount(teacher.id, accountId, provider.id)
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const { url } = await provider.createPayeeOnboardingLink(accountId, {
    refreshUrl: `${appUrl}/teacher/onboarding`,
    returnUrl: `${appUrl}/teacher/dashboard?payouts_setup=success`,
  })
  return { accountId, providerId: provider.id, url }
}

export async function savePayoutAccount(teacherId: string, accountId: string, providerId: string) {
  await createSupabaseServiceRoleClient().from('teacher_profiles').update({ payout_account_id: accountId, payment_provider: providerId }).eq('id', teacherId)
}

/**
 * Refreshes a teacher's payout status straight from the provider, for when
 * they come back from its onboarding page. The webhook does the same, but it
 * can arrive late, or never in local development (the provider can't reach
 * localhost). Returns whether the account can take payments now.
 */
export async function syncPayoutStatus(teacher: { id: string; payout_account_id: string | null; payment_provider: string | null; payments_enabled: boolean; payouts_enabled: boolean }) {
  if (!teacher.payout_account_id) return teacher.payments_enabled
  try {
    const status = await getPaymentProvider(teacher.payment_provider).getPayeeStatus(teacher.payout_account_id)
    if (status.paymentsEnabled !== teacher.payments_enabled || status.payoutsEnabled !== teacher.payouts_enabled) {
      await createSupabaseServiceRoleClient()
        .from('teacher_profiles')
        .update({ payments_enabled: status.paymentsEnabled, payouts_enabled: status.payoutsEnabled })
        .eq('id', teacher.id)
      revalidateTag(TEACHER_CATALOGUE_TAG)
    }
    return status.paymentsEnabled
  } catch {
    // Provider unreachable: keep what we had; the webhook will catch up.
    return teacher.payments_enabled
  }
}

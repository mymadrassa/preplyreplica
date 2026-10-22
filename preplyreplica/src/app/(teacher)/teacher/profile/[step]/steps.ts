export const PROFILE_STEPS = ['details', 'photo', 'identity', 'certificates', 'payouts', 'review'] as const
export type ProfileStep = (typeof PROFILE_STEPS)[number]

export const PROFILE_STEP_LABELS: Record<ProfileStep, string> = {
  details: 'Details',
  photo: 'Photo',
  identity: 'ID document',
  certificates: 'Certificates',
  payouts: 'Payouts',
  review: 'Review',
}

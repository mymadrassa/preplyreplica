export const TEACHER_WIZARD_STEPS = ['subjects', 'languages', 'profile', 'rate', 'media', 'payouts'] as const
export type TeacherWizardStep = (typeof TEACHER_WIZARD_STEPS)[number]

// Phone numbers are stored in international (E.164) form, e.g. +33612345678 --
// the same rule the database enforces (profiles_phone_format).

const E164 = /^\+[1-9]\d{7,14}$/

/**
 * Turns what a person typed into +E.164, or null if it isn't a valid
 * international number. Spaces, dots, dashes and brackets are ignored, and a
 * leading 00 is read as +. A number must include its country code.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let value = raw.trim().replace(/[\s.\-()/]/g, '')
  if (value.startsWith('00')) value = `+${value.slice(2)}`
  return E164.test(value) ? value : null
}

/** For showing a number without revealing it in full, e.g. "+33 6•• •• •• 78". */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  if (phone.length <= 6) return phone
  return `${phone.slice(0, 4)}${'•'.repeat(phone.length - 6)}${phone.slice(-2)}`
}

export const PHONE_HINT = 'Include your country code, e.g. +33 6 12 34 56 78 or +44 7700 900123.'

/**
 * Why a typed number isn't valid yet, in plain words, or null when it is
 * (or the field is still empty). Shown live under phone fields.
 */
export function phoneProblem(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (/[^\d\s.\-()/+]/.test(value)) return 'Use digits only (spaces and dashes are fine).'
  const compact = value.replace(/[\s.\-()/]/g, '')
  if (!compact.startsWith('+') && !compact.startsWith('00')) return 'Start with your country code, e.g. +33 or +212.'
  if ((compact.match(/\+/g) ?? []).length > 1 || compact.lastIndexOf('+') > 0) return 'The + goes only at the start.'
  const digits = compact.replace(/^\+|^00/, '')
  if (digits.startsWith('0')) return 'After the +, type your country code (e.g. +33), not the 0 of your local number.'
  if (digits.length < 8) return 'This number is too short.'
  if (digits.length > 15) return 'This number is too long.'
  return normalizePhone(value) ? null : PHONE_HINT
}

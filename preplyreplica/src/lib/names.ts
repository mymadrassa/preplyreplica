import { z } from 'zod'

// First and last name, asked at signup and stored together as profiles.full_name
// (the name shown in messages, bookings and emails).

export const firstNameSchema = z.string().trim().min(1, 'Enter your first name.').max(60, 'That first name is too long.')
export const lastNameSchema = z.string().trim().min(1, 'Enter your last name.').max(60, 'That last name is too long.')

/** "Amina" + "Benali" → "Amina Benali", with spacing tidied. */
export function fullNameFrom(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim()
}

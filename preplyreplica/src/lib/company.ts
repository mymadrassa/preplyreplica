// Who issues the receipts: My Madrassa's legal details, from the environment
// so they can be filled in without a code change.
//   COMPANY_NAME, COMPANY_ADDRESS, COMPANY_NUMBER, COMPANY_EMAIL
//   VAT_NUMBER — leave empty until My Madrassa is registered for VAT; receipts
//                only show VAT once it's set.

export interface CompanyDetails {
  name: string
  address: string | null
  companyNumber: string | null
  email: string
  vatNumber: string | null
}

export function companyDetails(): CompanyDetails {
  return {
    name: process.env.COMPANY_NAME || 'My Madrassa',
    address: process.env.COMPANY_ADDRESS || null,
    companyNumber: process.env.COMPANY_NUMBER || null,
    email: process.env.COMPANY_EMAIL || 'support@mymadrassa.com',
    vatNumber: process.env.VAT_NUMBER || null,
  }
}

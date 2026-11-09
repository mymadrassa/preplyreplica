import { describe, expect, it } from 'vitest'
import { cardRegion, documentNumber, packageReceipt, platformShare, statementRow, statementTotals, taxYearLabel, taxYearOf, taxYearRange, trialReceipt, vatIncluded } from '../receipts'

describe('platformShare', () => {
  it('is what is left after the teacher and the real card fee', () => {
    // A Mid package: UK card vs US card — the teacher always gets £175.
    expect(platformShare(23063, 17500, 366)).toBe(5197)
    expect(platformShare(23063, 17500, 770)).toBe(4793)
  })
})

describe('cardRegion', () => {
  it('tells UK, European and international cards apart', () => {
    expect(cardRegion('GB')).toBe('uk')
    expect(cardRegion('fr')).toBe('europe')
    expect(cardRegion('US')).toBe('international')
    expect(cardRegion(null)).toBeNull()
  })
})

describe('trialReceipt', () => {
  it('shows the price, the total and where the money goes', () => {
    const r = trialReceipt({ amount: 530, teacherFee: 500, processingFee: 28, refunded: 0, teacherName: 'Amina' })
    expect(r.lines[0].amount).toBe(530)
    expect(r.lines.at(-1)).toEqual({ label: 'Total paid', amount: 530, tone: 'total' })
    expect(r.split).toEqual({ teacher: 500, cardFee: 28, cardFeeEstimated: false, platform: 2 })
    expect(r.split.teacher + r.split.cardFee + r.split.platform).toBe(r.total)
  })

  it('estimates the card fee until the real one is known, and shows refunds', () => {
    const r = trialReceipt({ amount: 530, teacherFee: 500, processingFee: null, refunded: 530, teacherName: 'Amina' })
    expect(r.split.cardFeeEstimated).toBe(true)
    expect(r.netPaid).toBe(0)
    expect(r.lines.map((l) => l.tone)).toEqual([undefined, 'total', 'refund', 'net'])
  })
})

describe('packageReceipt', () => {
  const mid = { price: 23063, lessons: 10, tier: 'mid' as const, teacherFeePerLesson: 1750, refunded: 0, teacherName: 'Amina' }

  it('shows the platform price of a lesson, ten of them, and the discount that brings it to the price paid', () => {
    const r = packageReceipt({ ...mid, processingFee: 770 })
    expect(r.lines[0].amount).toBe(2563)
    expect(r.lines[1].amount).toBe(25625)
    expect(r.lines[1].amount + r.lines[2].amount).toBe(23063)
    expect(r.split).toEqual({ teacher: 17500, cardFee: 770, cardFeeEstimated: false, platform: 4793 })
  })

  it('takes unused lessons refunded off the net paid', () => {
    expect(packageReceipt({ ...mid, processingFee: 366, refunded: 4612 }).netPaid).toBe(18451)
  })
})

describe('statementRow', () => {
  it('shows a package lesson as a tenth of the package, adding up to the teacher pay', () => {
    const row = statementRow({ bookingId: 'b', date: '2026-10-10T10:00:00Z', studentName: 'Yusuf', subject: 'Tajwid', isTrial: false, teacherPay: 1750, pkg: { price: 23063, lessons: 10, processingFee: 770, estimate: 366 } })
    expect(row).toMatchObject({ kind: 'package', studentPaid: 2306, cardFee: 77, teacherPay: 1750, platform: 479 })
    expect(row.cardFee + row.platform + row.teacherPay).toBe(row.studentPaid)
  })

  it('shows a trial from its payment, net of refunds', () => {
    const row = statementRow({ bookingId: 't', date: '2026-10-10T10:00:00Z', studentName: 'Yusuf', subject: 'Trial', isTrial: true, teacherPay: 250, payment: { amount: 530, refunded: 265, processingFee: 28, estimate: 28 } })
    expect(row).toMatchObject({ kind: 'trial', studentPaid: 265, cardFee: 28, platform: -13 })
    expect(statementTotals([row, row]).teacherPay).toBe(500)
  })
})

describe('documents', () => {
  it('numbers receipts and statements', () => {
    expect(documentNumber('R', '3f2a9c1e-77aa-4bcd-9e0f-1234567890ab')).toBe('MM-R-3F2A9C1E')
  })

  it('follows the UK tax year (6 April to 5 April)', () => {
    expect(taxYearOf('2026-04-05T23:00:00Z')).toBe(2025)
    expect(taxYearOf('2026-04-06T00:00:00Z')).toBe(2026)
    expect(taxYearRange(2026).end.toISOString()).toBe('2027-04-06T00:00:00.000Z')
    expect(taxYearLabel(2026)).toBe('2026–27')
  })

  it('finds the VAT inside a VAT-inclusive price', () => {
    expect(vatIncluded(2563)).toBe(427)
    expect(vatIncluded(600)).toBe(100)
  })
})

import { describe, expect, it } from 'vitest'
import { calculatePricing, toPence, toPounds } from '../pricing'

describe('calculatePricing', () => {
  it('charges the student base + 40% commission', () => {
    const pricing = calculatePricing(20, 1)
    expect(pricing.baseAmount).toBe(20)
    expect(pricing.platformCommission).toBe(8)
    expect(pricing.totalStudentPays).toBe(28)
  })

  it('always pays the teacher their full base rate, never reduced by fees', () => {
    const pricing = calculatePricing(20, 1)
    expect(pricing.teacherReceives).toBe(pricing.baseAmount)
    expect(pricing.teacherReceives).toBe(20)
  })

  it('scales the base amount by fractional lesson duration', () => {
    const pricing = calculatePricing(25, 0.5)
    expect(pricing.baseAmount).toBe(12.5)
    expect(pricing.platformCommission).toBe(5)
    expect(pricing.totalStudentPays).toBe(17.5)
  })

  it('estimates the Stripe fee as 1.5% of the total charge plus a fixed 20p', () => {
    const pricing = calculatePricing(20, 1)
    // totalStudentPays = 28 -> 28 * 0.015 + 0.20 = 0.62
    expect(pricing.estimatedStripeFee).toBeCloseTo(0.62, 2)
  })

  it('rounds all monetary values to 2 decimal places', () => {
    const pricing = calculatePricing(19.99, 1 / 3)
    for (const value of [pricing.baseAmount, pricing.platformCommission, pricing.totalStudentPays, pricing.estimatedStripeFee, pricing.teacherReceives]) {
      expect(Number.isInteger(value * 100)).toBe(true)
    }
  })

  it('reports the currency as GBP', () => {
    expect(calculatePricing(20, 1).currency).toBe('gbp')
  })

  it('produces zero commission and zero charge for a free (0 rate) lesson', () => {
    const pricing = calculatePricing(0, 1)
    expect(pricing.baseAmount).toBe(0)
    expect(pricing.platformCommission).toBe(0)
    expect(pricing.totalStudentPays).toBe(0)
  })
})

describe('toPence / toPounds', () => {
  it('converts pounds to integer pence', () => {
    expect(toPence(20)).toBe(2000)
    expect(toPence(12.5)).toBe(1250)
    expect(toPence(0.1)).toBe(10)
  })

  it('round-trips pence back to pounds', () => {
    expect(toPounds(2000)).toBe(20)
    expect(toPounds(1250)).toBe(12.5)
  })

  it('avoids floating point drift for common amounts', () => {
    // 0.1 + 0.2 famously != 0.3 in raw floating point — toPence must not leak that.
    expect(toPence(0.1 + 0.2)).toBe(30)
  })
})

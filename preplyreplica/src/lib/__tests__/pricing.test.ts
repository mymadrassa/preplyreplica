import { describe, expect, it } from 'vitest'
import { lessonPrice, packagePrice, tierRate, toPence, toPounds, trialPrice } from '../pricing'

// Every expectation below is a figure from Pricing_Model_GBP.pdf.

describe('lessonPrice', () => {
  it.each([
    ['starter', 15, { commission: 6, studentPays: 23, processingFee: 0.55, platformNet: 7.45 }],
    ['mid', 17.5, { commission: 6.13, studentPays: 25.63, processingFee: 0.58, platformNet: 7.55 }],
    ['top', 20, { commission: 6, studentPays: 28, processingFee: 0.62, platformNet: 7.38 }],
  ] as const)('prices a one-hour %s lesson', (tier, rate, expected) => {
    const price = lessonPrice(tier)
    expect(price).toMatchObject({ teacherReceives: rate, bookingFee: 2, ...expected })
  })

  it('pays the teacher the full rate of their tier', () => {
    expect([tierRate('starter'), tierRate('mid'), tierRate('top')]).toEqual([15, 17.5, 20])
  })
})

describe('trialPrice', () => {
  it('is the same fixed price for every teacher', () => {
    expect(trialPrice()).toEqual({ teacherReceives: 5, commission: 0, bookingFee: 0.3, studentPays: 5.3, processingFee: 0.28, platformNet: 0.02 })
  })
})

describe('packagePrice', () => {
  it.each([
    ['starter', 15, { normalPrice: 230, price: 207, processingFee: 3.31, platformNet: 53.69 }],
    ['mid', 17.5, { normalPrice: 256.25, price: 230.63, processingFee: 3.66, platformNet: 51.97 }],
    ['top', 20, { normalPrice: 280, price: 252, processingFee: 3.98, platformNet: 48.02 }],
  ] as const)('prices a 10-lesson %s package at 10%% off', (tier, rate, expected) => {
    expect(packagePrice(tier)).toMatchObject({ lessons: 10, teacherPerLesson: rate, ...expected })
  })

  it('refunds an unused lesson at the discounted per-lesson price', () => {
    expect(packagePrice('starter').perLesson).toBe(20.7)
  })
})

describe('toPence / toPounds', () => {
  it('converts both ways', () => {
    expect(toPence(25.63)).toBe(2563)
    expect(toPounds(2563)).toBe(25.63)
  })
})

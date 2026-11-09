import { describe, expect, it } from 'vitest'
import { groupPayouts, lessonPayoutAmount, monthStart, monthlyPayoutDateFor, nextPayoutDate, payoutAfterPartialRefund, payoutDateFor, payoutEligibleAt, payoutPeriod, periodLabel } from '../payouts'

describe('payout dates', () => {
  it('makes a lesson payable 48 hours after it ends', () => {
    expect(payoutEligibleAt('2026-10-20T11:00:00.000Z')).toBe('2026-10-22T11:00:00.000Z')
  })

  it('pays on the 3rd for the month before', () => {
    const payoutDay = new Date('2026-11-03T06:00:00Z')
    expect(monthStart(payoutDay).toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(payoutPeriod(payoutDay)).toBe('2026-10')
    expect(payoutPeriod(new Date('2027-01-03T06:00:00Z'))).toBe('2026-12')
    expect(periodLabel('2026-10')).toBe('October 2026')
  })

  it('puts the last lesson of the month in that month’s payout, after its 48 hours', () => {
    const lastLesson = '2026-10-31T23:59:00Z'
    expect(payoutDateFor(lastLesson).toISOString()).toBe('2026-11-03T00:00:00.000Z')
    expect(new Date(payoutEligibleAt(lastLesson)) < new Date('2026-11-03T06:00:00Z')).toBe(true)
    expect(payoutDateFor('2026-12-15T10:00:00Z').toISOString()).toBe('2027-01-03T00:00:00.000Z')
  })

  it('names the next payout day', () => {
    expect(nextPayoutDate(new Date('2026-11-02T12:00:00Z')).toISOString()).toBe('2026-11-03T00:00:00.000Z')
    expect(nextPayoutDate(new Date('2026-11-08T12:00:00Z')).toISOString()).toBe('2026-12-03T00:00:00.000Z')
    expect(nextPayoutDate(new Date('2026-12-31T23:00:00Z')).toISOString()).toBe('2027-01-03T00:00:00.000Z')
  })
})

describe('monthlyPayoutDateFor', () => {
  it('uses the lesson’s own payout day, or the next one once it has passed', () => {
    const october = '2026-10-20T11:00:00Z'
    expect(monthlyPayoutDateFor(october, new Date('2026-10-25T12:00:00Z')).toISOString()).toBe('2026-11-03T00:00:00.000Z')
    expect(monthlyPayoutDateFor(october, new Date('2026-11-02T12:00:00Z')).toISOString()).toBe('2026-11-03T00:00:00.000Z')
    // Resolved after the 3rd: next month's payout.
    expect(monthlyPayoutDateFor(october, new Date('2026-11-10T12:00:00Z')).toISOString()).toBe('2026-12-03T00:00:00.000Z')
  })
})

describe('groupPayouts', () => {
  const cutoff = monthStart(new Date('2026-11-03T06:00:00Z'))

  it('totals the month’s lessons per teacher, including the 31st', () => {
    const groups = groupPayouts(
      [
        { id: 'a', teacher_id: 't1', end_at: '2026-10-10T10:00:00Z', is_trial: false, payout_amount: 1500 },
        { id: 'b', teacher_id: 't1', end_at: '2026-10-31T23:00:00Z', is_trial: false, payout_amount: 1350 },
        { id: 'c', teacher_id: 't2', end_at: '2026-10-31T23:59:00Z', is_trial: false, payout_amount: 500 },
      ],
      cutoff
    )
    expect(groups.get('t1')).toEqual({ amount: 2850, lessonIds: ['a', 'b'] })
    expect(groups.get('t2')).toEqual({ amount: 500, lessonIds: ['c'] })
  })

  it('leaves out next month’s lessons, trials (paid on their own) and lessons without an amount', () => {
    const groups = groupPayouts(
      [
        { id: 'nov', teacher_id: 't1', end_at: '2026-11-01T09:00:00Z', is_trial: false, payout_amount: 1500 },
        { id: 'trial', teacher_id: 't1', end_at: '2026-10-05T09:00:00Z', is_trial: true, payout_amount: 500 },
        { id: 'none', teacher_id: 't1', end_at: '2026-10-05T09:00:00Z', is_trial: false, payout_amount: null },
      ],
      cutoff
    )
    expect(groups.size).toBe(0)
  })
})

describe('lesson amounts', () => {
  it('uses the package share for a package lesson, else the payment', () => {
    expect(lessonPayoutAmount({ payment: null, pkg: { teacher_fee_per_lesson: 1350 } })).toBe(1350)
    expect(lessonPayoutAmount({ payment: { teacher_fee: 500 }, pkg: null })).toBe(500)
    expect(lessonPayoutAmount({ payment: null, pkg: null })).toBeNull()
  })

  it('takes a partial refund out of the teacher share proportionally', () => {
    expect(payoutAfterPartialRefund(500, 265, 530)).toBe(250)
    expect(payoutAfterPartialRefund(500, 0, 530)).toBe(500)
    expect(payoutAfterPartialRefund(500, 1000, 530)).toBe(0)
  })
})

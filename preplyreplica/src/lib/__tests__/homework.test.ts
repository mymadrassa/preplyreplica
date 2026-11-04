import { describe, expect, it } from 'vitest'
import { maskPhone, normalizePhone, phoneProblem } from '../phone'
import { formatRange, homeworkParts, rangeFromRow, rangeToRow, validateRange } from '../homework'

const surahs = [
  { id: 2, name: 'Al-Baqarah', verses: 286 },
  { id: 3, name: 'Al-Imran', verses: 200 },
]

describe('normalizePhone', () => {
  it('accepts international numbers written with spaces, dots or dashes', () => {
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678')
    expect(normalizePhone('+44-7700.900-123')).toBe('+447700900123')
    expect(normalizePhone('(+33) 6 12 34 56 78')).toBe('+33612345678')
  })

  it('reads a leading 00 as +', () => {
    expect(normalizePhone('0033612345678')).toBe('+33612345678')
  })

  it('refuses numbers without a country code, too short, or with letters', () => {
    expect(normalizePhone('0612345678')).toBeNull()
    expect(normalizePhone('+3312')).toBeNull()
    expect(normalizePhone('+33 6 12 AB 56 78')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })

  it('masks the middle of a number for display', () => {
    expect(maskPhone('+33612345678')).toBe('+336••••••78')
  })
})

describe('ayah ranges', () => {
  it('formats a range inside one surah, a single ayah, and across surahs', () => {
    expect(formatRange({ fromSurah: 2, fromAyah: 1, toSurah: 2, toAyah: 20 }, surahs)).toBe('Al-Baqarah 1–20')
    expect(formatRange({ fromSurah: 2, fromAyah: 5, toSurah: 2, toAyah: 5 }, surahs)).toBe('Al-Baqarah 5')
    expect(formatRange({ fromSurah: 2, fromAyah: 286, toSurah: 3, toAyah: 10 }, surahs)).toBe('Al-Baqarah 286 – Al-Imran 10')
    expect(formatRange(null)).toBe('—')
  })

  it('accepts valid ranges and explains invalid ones', () => {
    expect(validateRange({ fromSurah: 2, fromAyah: 1, toSurah: 2, toAyah: 20 }, surahs)).toBeNull()
    expect(validateRange({ fromSurah: 2, fromAyah: 20, toSurah: 2, toAyah: 1 }, surahs)).toMatch(/after the start/)
    expect(validateRange({ fromSurah: 3, fromAyah: 1, toSurah: 2, toAyah: 1 }, surahs)).toMatch(/after the start/)
    expect(validateRange({ fromSurah: 2, fromAyah: 300, toSurah: 2, toAyah: 300 }, surahs)).toMatch(/only 286/)
    expect(validateRange({ fromSurah: 0, fromAyah: 1, toSurah: 2, toAyah: 1 }, surahs)).toMatch(/Choose/)
  })

  it('round-trips a range through the database columns', () => {
    const range = { fromSurah: 2, fromAyah: 1, toSurah: 3, toAyah: 4 }
    expect(rangeFromRow(rangeToRow(range, 'revision'), 'revision')).toEqual(range)
    expect(rangeFromRow(rangeToRow(null, 'memorization'), 'memorization')).toBeNull()
  })

  it('builds the message parts, with a dash for what is missing', () => {
    expect(homeworkParts({ revision: null, memorization: { fromSurah: 2, fromAyah: 21, toSurah: 2, toAyah: 25 }, note: '  ' }, surahs)).toEqual({
      revision: '—',
      memorization: 'Al-Baqarah 21–25',
      note: '—',
    })
  })
})

describe('phoneProblem', () => {
  it('is quiet while empty and once valid', () => {
    expect(phoneProblem('')).toBeNull()
    expect(phoneProblem('+33 6 12 34 56 78')).toBeNull()
    expect(phoneProblem('00212 6 12 34 56 78')).toBeNull()
  })

  it('explains what is wrong', () => {
    expect(phoneProblem('kjkj')).toBe('Use digits only (spaces and dashes are fine).')
    expect(phoneProblem('06 12 34 56 78')).toBe('Start with your country code, e.g. +33 or +212.')
    expect(phoneProblem('+06 12 34 56 78')).toBe('After the +, type your country code (e.g. +33), not the 0 of your local number.')
    expect(phoneProblem('+33 6')).toBe('This number is too short.')
    expect(phoneProblem('+33 6 12+34')).toBe('The + goes only at the start.')
  })
})

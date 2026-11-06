import { describe, expect, it } from 'vitest'
import { addReasonLine, automaticReviewMessage } from '../reviewMessage'

describe('automaticReviewMessage', () => {
  it('lists what is missing and suspicious files', () => {
    expect(automaticReviewMessage([{ title: 'Add a profile photo', description: 'Students see it on your profile.' }], 1)).toBe(
      'Please complete the following, then submit your profile again:\n' +
        '• Add a profile photo: Students see it on your profile.\n' +
        '• Upload your document again: one file couldn\'t be accepted. Please use a PDF, JPEG, PNG or WebP file (a scan or a photo).'
    )
  })

  it('is empty when nothing is missing', () => {
    expect(automaticReviewMessage([], 0)).toBe('')
  })
})

describe('addReasonLine', () => {
  it('starts an empty message with an intro, then adds bullets once each', () => {
    const first = addReasonLine('', 'Fix A.')
    expect(first).toBe('Please make the following changes, then submit your profile again:\n• Fix A.')
    const second = addReasonLine(first, 'Fix B.')
    expect(second).toBe(`${first}\n• Fix B.`)
    expect(addReasonLine(second, 'Fix A.')).toBe(second)
  })
})

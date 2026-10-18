import { describe, expect, it } from 'vitest'
import { normalizeVideoUrl } from '../videoUrl'

describe('normalizeVideoUrl', () => {
  it('rewrites a YouTube watch link to its embed form', () => {
    expect(normalizeVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      provider: 'youtube',
    })
  })

  it('rewrites a youtu.be short link to its embed form', () => {
    expect(normalizeVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      provider: 'youtube',
    })
  })

  it('passes through an already-embed YouTube link', () => {
    expect(normalizeVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')?.provider).toBe('youtube')
  })

  it('rewrites a vimeo.com link to the player embed form', () => {
    expect(normalizeVideoUrl('https://vimeo.com/123456789')).toEqual({
      embedUrl: 'https://player.vimeo.com/video/123456789',
      provider: 'vimeo',
    })
  })

  it('rewrites a Google Drive share link to its /preview form', () => {
    expect(normalizeVideoUrl('https://drive.google.com/file/d/1aBcD3fGhIjK/view?usp=sharing')).toEqual({
      embedUrl: 'https://drive.google.com/file/d/1aBcD3fGhIjK/preview',
      provider: 'google-drive',
    })
  })

  it('rejects an unrecognized domain', () => {
    expect(normalizeVideoUrl('https://example.com/my-video.mp4')).toBeNull()
  })

  it('rejects a javascript: scheme', () => {
    expect(normalizeVideoUrl('javascript:alert(1)')).toBeNull()
  })

  it('rejects a data: URI', () => {
    expect(normalizeVideoUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
  })

  it('rejects http (non-https) even for an otherwise-known host', () => {
    expect(normalizeVideoUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })

  it('returns null for an empty or whitespace-only string', () => {
    expect(normalizeVideoUrl('')).toBeNull()
    expect(normalizeVideoUrl('   ')).toBeNull()
  })
})

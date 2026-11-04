import { describe, expect, it } from 'vitest'
import { detectFileKind, extensionOf, kindFromMime } from '../fileSignature'

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? Array.from(p, (c) => c.charCodeAt(0)) : p)).concat(new Array(16).fill(0)))

describe('detectFileKind', () => {
  it('recognises the accepted formats from their first bytes', () => {
    expect(detectFileKind(bytes('%PDF-1.7'))).toBe('pdf')
    expect(detectFileKind(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg')
    expect(detectFileKind(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png')
    expect(detectFileKind(bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 '))).toBe('webp')
    expect(detectFileKind(bytes([0, 0, 0, 0x20], 'ftypisom'))).toBe('mp4')
    expect(detectFileKind(bytes([0, 0, 0, 0x14], 'ftypqt  '))).toBe('mov')
    expect(detectFileKind(bytes([0x1a, 0x45, 0xdf, 0xa3]))).toBe('webm')
  })

  it('rejects executables, web pages and scripts whatever they are named', () => {
    expect(detectFileKind(bytes('MZ', [0x90, 0]))).toBeNull() // Windows .exe
    expect(detectFileKind(bytes([0x7f], 'ELF'))).toBeNull() // Linux binary
    expect(detectFileKind(bytes('<!DOCTYPE html><script>'))).toBeNull()
    expect(detectFileKind(bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>'))).toBeNull()
    expect(detectFileKind(bytes('PK', [3, 4]))).toBeNull() // zip, docx…
    expect(detectFileKind(bytes('#!/bin/sh'))).toBeNull()
  })
})

describe('helpers', () => {
  it('maps declared types and reads extensions', () => {
    expect(kindFromMime('application/pdf')).toBe('pdf')
    expect(kindFromMime('image/svg+xml')).toBeNull()
    expect(extensionOf('abc/123-x.PDF')).toBe('pdf')
    expect(extensionOf('abc/noext')).toBe('')
  })
})

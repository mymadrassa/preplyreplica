// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ROLE_COOKIE_TTL_SECONDS, readRoleCookie, signRoleCookie } from '../roleCookie'

const SECRET = 'test-secret'
const USER = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const NOW = Date.UTC(2026, 9, 21, 12, 0, 0)

describe('role cookie', () => {
  it('round-trips a role for the same user within its lifetime', async () => {
    const cookie = await signRoleCookie(USER, 'teacher', NOW, SECRET)
    expect(await readRoleCookie(cookie!, USER, NOW + 60_000, SECRET)).toBe('teacher')
  })

  it('expires after its lifetime', async () => {
    const cookie = await signRoleCookie(USER, 'teacher', NOW, SECRET)
    expect(await readRoleCookie(cookie!, USER, NOW + (ROLE_COOKIE_TTL_SECONDS + 1) * 1000, SECRET)).toBeNull()
  })

  it('rejects a cookie belonging to another user', async () => {
    const cookie = await signRoleCookie(USER, 'teacher', NOW, SECRET)
    expect(await readRoleCookie(cookie!, 'someone-else', NOW, SECRET)).toBeNull()
  })

  it('rejects a role that was edited after signing', async () => {
    const cookie = await signRoleCookie(USER, 'student', NOW, SECRET)
    const forged = cookie!.replace('.student.', '.admin.')
    expect(await readRoleCookie(forged, USER, NOW, SECRET)).toBeNull()
  })

  it('rejects a cookie signed with a different secret', async () => {
    const cookie = await signRoleCookie(USER, 'admin', NOW, 'attacker-secret')
    expect(await readRoleCookie(cookie!, USER, NOW, SECRET)).toBeNull()
  })

  it('ignores missing or malformed values', async () => {
    expect(await readRoleCookie(undefined, USER, NOW, SECRET)).toBeNull()
    expect(await readRoleCookie('not-a-cookie', USER, NOW, SECRET)).toBeNull()
    expect(await readRoleCookie(`${USER}.teacher.abc.sig`, USER, NOW, SECRET)).toBeNull()
  })

  it('turns caching off when there is no secret', async () => {
    expect(await signRoleCookie(USER, 'teacher', NOW, null)).toBeNull()
  })
})

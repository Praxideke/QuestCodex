import { describe, expect, it } from 'vitest'
import type { ProfileSummary } from '../api/progress'
import { loadProfile, pickProfile, saveProfile } from './profile'

const p = (id: string): ProfileSummary =>
  ({ id, nickname: id, level: 1, side: 'Usec', hasCharacter: true, isActive: false, lastSessionAt: null })

describe('pickProfile', () => {
  it('저장한 프로필이 목록에 있으면 그것, 없으면 첫 번째(서버 정렬상 접속 중)', () => {
    expect(pickProfile([p('a'), p('b')], 'b')).toBe('b')
    expect(pickProfile([p('a'), p('b')], 'gone')).toBe('a')
    expect(pickProfile([p('a')], null)).toBe('a')
    expect(pickProfile([], 'a')).toBeNull()
  })
})

describe('loadProfile / saveProfile', () => {
  it('저장소가 throw 해도 null·무시', () => {
    const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(loadProfile(broken)).toBeNull()
    expect(() => saveProfile('a', broken)).not.toThrow()
  })
  it('저장한 값을 읽는다', () => {
    const map = new Map<string, string>()
    const s = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
    saveProfile('abc', s)
    expect(loadProfile(s)).toBe('abc')
  })
})

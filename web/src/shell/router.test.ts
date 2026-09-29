import { describe, expect, it } from 'vitest'
import { hashFor, parseHash, urlWithHash } from './router'

describe('parseHash', () => {
  it('#/wiki → wiki, 빈 쿼리', () => {
    const r = parseHash('#/wiki')
    expect(r?.page).toBe('wiki')
    expect(r?.query.get('quest')).toBeNull()
  })
  it('#/wiki?quest=abc → quest 쿼리', () => {
    expect(parseHash('#/wiki?quest=abc')?.query.get('quest')).toBe('abc')
  })
  it('#/progress → progress, 소메뉴 기본값 overview', () => {
    expect(parseHash('#/progress')?.page).toBe('progress')
    expect(parseHash('#/progress')?.sub).toBe('overview')
  })
  it('#/progress/<sub>?map= → 소메뉴와 쿼리', () => {
    const r = parseHash('#/progress/raid?map=woods')
    expect(r?.sub).toBe('raid')
    expect(r?.query.get('map')).toBe('woods')
    expect(parseHash('#/progress/items')?.sub).toBe('items')
  })
  it('모르는 소메뉴는 overview, 더 깊은 경로는 null', () => {
    expect(parseHash('#/progress/nope')?.sub).toBe('overview')
    expect(parseHash('#/progress/raid/x')).toBeNull()
  })
  it('위키에는 소메뉴가 없다', () => {
    expect(parseHash('#/wiki')?.sub).toBeNull()
  })
  it('빈 값·모르는 값·접두어 없는 값은 null', () => {
    expect(parseHash('')).toBeNull()
    expect(parseHash('#')).toBeNull()
    expect(parseHash('#/nope')).toBeNull()
    expect(parseHash('#wiki')).toBeNull()
    expect(parseHash('#/wiki/extra')).toBeNull()
  })
  it('# 없이 들어와도 파싱', () => {
    expect(parseHash('/progress')?.page).toBe('progress')
  })
})

describe('hashFor', () => {
  it('#/<page>', () => {
    expect(hashFor('wiki')).toBe('#/wiki')
    expect(hashFor('progress')).toBe('#/progress')
  })
  it('#/progress/<sub>?<query>, 위키는 소메뉴를 무시', () => {
    expect(hashFor('progress', 'raid')).toBe('#/progress/raid')
    expect(hashFor('progress', 'raid', { map: 'woods' })).toBe('#/progress/raid?map=woods')
    expect(hashFor('wiki', null, { quest: 'abc' })).toBe('#/wiki?quest=abc')
    expect(hashFor('wiki', 'raid')).toBe('#/wiki')
  })
})

describe('urlWithHash', () => {
  it('현재 경로를 앞에 붙인다 (<base href="/"> 가 경로를 먹지 않도록)', () => {
    expect(urlWithHash('/questcodex', '', '#/wiki')).toBe('/questcodex#/wiki')
    expect(urlWithHash('/questcodex', '', '#/progress')).toBe('/questcodex#/progress')
  })
  it('쿼리 스트링을 보존한다', () => {
    expect(urlWithHash('/questcodex', '?a=1', '#/wiki')).toBe('/questcodex?a=1#/wiki')
  })
})

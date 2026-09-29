import { describe, expect, it } from 'vitest'
import { getT } from '../i18n/index'
import type { NameLookup } from '../wiki/derive'
import { counterText, lockReasonText, statusLabel } from './format'

const ko = getT('kr')
const en = getT('en')
const lookup: NameLookup = { traderName: (id) => (id === 'pk' ? 'Peacekeeper' : id), questName: (id) => (id === 'q1' ? 'Mentor' : undefined) }

describe('statusLabel', () => {
  it('알려진 상태는 번역, 모르는 상태는 원문', () => {
    expect(statusLabel('AvailableForFinish', ko)).toBe('완료 보고 대기')
    expect(statusLabel('Started', en)).toBe('Active')
    expect(statusLabel('Weird', en)).toBe('Weird')
  })
})

describe('lockReasonText', () => {
  it('종류별 문구, 현재 값을 함께', () => {
    expect(lockReasonText({ kind: 'quest', questId: 'q1', needStatuses: ['Success'], currentStatus: 'Started' }, lookup, en))
      .toBe('Mentor: Completed needed (now Active)')
    expect(lockReasonText({ kind: 'level', need: 61, compare: '>=', current: 47 }, lookup, ko)).toBe('레벨 61 필요 (지금 47)')
    expect(lockReasonText({ kind: 'traderStanding', traderId: 'pk', need: 0.4, compare: '>=', current: 0.123 }, lookup, en))
      .toBe('Peacekeeper standing 0.40 needed (now 0.12)')
    expect(lockReasonText({ kind: 'faction', need: 'bear' }, lookup, en)).toBe('BEAR only')
  })
  it('카탈로그에 없는 선행은 ID 그대로', () => {
    expect(lockReasonText({ kind: 'quest', questId: 'zz', needStatuses: ['Fail'], currentStatus: 'Success' }, lookup, ko))
      .toBe('zz: 실패 필요 (지금 완료)')
  })
})

describe('counterText', () => {
  it('current/target, target 없으면 null', () => {
    expect(counterText({ current: 7609, target: 50000, done: false })).toBe('7,609/50,000')
    expect(counterText({ current: 0, target: null, done: false })).toBeNull()
    expect(counterText(undefined)).toBeNull()
  })
})

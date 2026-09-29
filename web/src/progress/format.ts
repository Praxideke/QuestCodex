import type { LockReason, ObjectiveProgress, QuestStatus } from '../api/progress'
import type { T, UiKey } from '../i18n/index'
import type { NameLookup } from '../wiki/derive'
import { formatInt } from '../wiki/format'

// 진행현황 표시 문자열. wiki/format.ts 와 같은 규칙 — t 를 인자로 받아 React 없이 테스트된다.

const STATUSES = new Set([
  'Locked', 'AvailableForStart', 'Started', 'AvailableForFinish', 'Success', 'Fail', 'FailRestartable', 'MarkedAsFailed', 'Expired',
])

/** 모르는 상태(모드·신규 SPT)는 원문 그대로 */
export function statusLabel(status: QuestStatus, t: T): string {
  return STATUSES.has(status) ? t(`status.${status}` as UiKey) : status
}

/** 평판은 소수 둘째 자리까지(서버가 2.11 같은 값을 준다), 나머지는 정수 */
function num(n: number): string {
  return Number.isInteger(n) ? formatInt(n) : n.toFixed(2)
}

export function lockReasonText(r: LockReason, lookup: NameLookup, t: T): string {
  switch (r.kind) {
    case 'quest':
      return t('lock.quest', {
        quest: lookup.questName(r.questId) ?? r.questId,
        need: r.needStatuses.map((s) => statusLabel(s, t)).join('/'),
        now: statusLabel(r.currentStatus, t),
      })
    case 'level':
      return t('lock.level', { need: r.need, now: r.current })
    case 'traderLoyalty':
      return t('lock.loyalty', { trader: lookup.traderName(r.traderId), need: r.need, now: r.current })
    case 'traderStanding':
      return t('lock.standing', { trader: lookup.traderName(r.traderId), need: num(r.need), now: num(r.current) })
    case 'faction':
      return t('lock.faction', { side: r.need.toUpperCase() })
    case 'other':
      return r.conditionType
  }
}

/** "7/15". target 이 없으면(카운터 없는 목표) null */
export function counterText(op: ObjectiveProgress | undefined): string | null {
  if (!op || op.target === null) return null
  return `${formatInt(op.current)}/${formatInt(op.target)}`
}

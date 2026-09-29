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

/** 핸드북 최상위 카테고리 id — 게임 로케일에 번역이 없어(kr 도 영어) i18n itemCat.<id> 로 이름을 붙인다 */
const ITEM_CATEGORIES = new Set([
  '5b5f78dc86f77409407a7f8e', '5b5f71a686f77447ed5636ab', '5b47574386f77428ca22b346', '5b47574386f77428ca22b33f',
  '6564b96a189fe36f356d177c', '5b47574386f77428ca22b344', '5b47574386f77428ca22b340', '5b47574386f77428ca22b33e',
  '5b47574386f77428ca22b341', '5b47574386f77428ca22b342', '5b47574386f77428ca22b343', '5b47574386f77428ca22b345',
  '5b619f1a86f77450a702a6f3', '5b5f78b786f77447ed5636af',
])

/** 모르는 카테고리(모드)와 핸드북에 없는 아이템은 "기타" */
export function itemCategoryLabel(id: string, t: T): string {
  return ITEM_CATEGORIES.has(id) ? t(`itemCat.${id}` as UiKey) : t('itemCat.other')
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

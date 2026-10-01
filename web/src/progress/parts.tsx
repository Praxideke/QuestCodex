import type { CatalogQuest, ItemRef } from '../api/catalog'
import type { ObjectiveProgress, QuestProgress } from '../api/progress'
import { cls } from '../cls'
import type { T } from '../i18n/index'
import { useT } from '../i18n/I18nContext'
import { navigate } from '../shell/router'
import { formatInt, formatObjective } from '../wiki/format'
import type { ListLine } from '../wiki/LineList'
import { distinctNames } from '../wiki/prep'

// 진행현황 세 화면이 같이 쓰는 작은 조각.

/** 퀘스트 이름 → 위키 상세로 점프 (C3). 위키가 딥링크를 소비해 필터 리셋 → 펼침 → 스크롤한다. */
export function QuestLink({ quest }: { quest: CatalogQuest }) {
  return (
    <button type="button" className="qc-link" onClick={() => navigate('wiki', null, { quest: quest.id })}>
      {quest.name}
    </button>
  )
}

/** 아이템 이름. 대체 목록이면 첫 이름 + "외 N종" (이름이 같은 변종은 하나로 센다 — 도그태그 변종들) */
export function ItemName({ items }: { items: ItemRef[] }) {
  const t = useT()
  const names = distinctNames(items.map((i) => i.name))
  return (
    <span title={names.length > 1 ? names.join('\n') : undefined}>
      {names[0]}
      {names.length > 1 && <span className="qc-muted"> {t('prep.more', { n: names.length - 1 })}</span>}
    </span>
  )
}

/**
 * 목표 카운터 "현재 / 목표". 현황의 상인별 진행률(.qc-bar__num)과 같은 모양 — 현재는 굵게, 목표는 흐리게, 0 이면 둘 다 흐리게.
 * 열 폭을 고정해 줄마다 "/" 위치가 맞는다. 카운터 없는 목표(target null)는 비운다.
 */
export function Counter({ op }: { op: ObjectiveProgress | undefined }) {
  if (!op || op.target === null) return null
  return (
    <span className={cls('qc-count', op.current === 0 && 'is-zero')}>
      <span className="qc-count__cur">{formatInt(op.current)}</span>
      <span className="qc-count__total">/ {formatInt(op.target)}</span>
    </span>
  )
}

/** 펼친 행의 목표 줄: 위키 문구 + 카운터 + 완료 취소선 */
export function objectiveLines(quest: CatalogQuest, qp: QuestProgress, t: T): ListLine[] {
  return quest.objectives.map((o) => {
    const op = qp.objectives[o.conditionId]
    return { ...formatObjective(o, t), aside: <Counter op={op} />, state: op?.done ? 'done' : undefined }
  })
}

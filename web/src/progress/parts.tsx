import type { CatalogQuest, ItemRef } from '../api/catalog'
import { useT } from '../i18n/I18nContext'
import { navigate } from '../shell/router'
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

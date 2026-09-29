import { useMemo, useState } from 'react'
import type { Catalog, CatalogQuest } from '../api/catalog'
import type { Holding, ProfileProgress } from '../api/progress'
import { cls } from '../cls'
import { useT } from '../i18n/I18nContext'
import { navigate } from '../shell/router'
import { orderTraders, type NameLookup } from '../wiki/derive'
import { formatObjective, lineText } from '../wiki/format'
import {
  countTabs, filterProgressQuests, firstOpenObjective, handoverReady, isUnreachable, QUEST_TABS, questProgress,
  tradersWithQuests, type QuestTab,
} from './derive'
import { counterText, lockReasonText } from './format'
import { QuestLink } from './parts'

interface OverviewViewProps {
  catalog: Catalog
  progress: ProfileProgress
  inventory: Record<string, Holding>
  lookup: NameLookup
  highlight: ReadonlySet<string>
}

/** 현황 — "어디까지 왔나". 상인별 진행률(C4), 상인에게 갈 것(T1~T3), 상태별 퀘스트. */
export function OverviewView({ catalog, progress, inventory, lookup, highlight }: OverviewViewProps) {
  const t = useT()
  const quests = useMemo(() => Object.values(catalog.quests), [catalog])
  const traderIds = useMemo(
    () => tradersWithQuests(orderTraders(catalog.traders).map((x) => x.id), progress),
    [catalog, progress],
  )
  const turnIn = quests.filter((q) => questProgress(progress, q.id).status === 'AvailableForFinish')
  const accept = quests.filter((q) => questProgress(progress, q.id).status === 'AvailableForStart')
  const ready = useMemo(() => handoverReady(catalog, progress, inventory), [catalog, progress, inventory])

  return (
    <div className="qc-overview">
      <section className="qc-card">
        <h3 className="qc-card__h">{t('overview.traders')}</h3>
        <ul className="qc-bars">
          {traderIds.map((id) => {
            const s = progress.traderStats[id]
            const state = s.success === 0 ? ' is-zero' : s.success === s.total ? ' is-full' : ''
            return (
              <li key={id} className={`qc-bar${state}`}>
                <span className="qc-bar__name">{lookup.traderName(id)}</span>
                <span className="qc-bar__track"><span className="qc-bar__fill" style={{ width: `${(s.success / s.total) * 100}%` }} /></span>
                <span className="qc-bar__num">
                  <span className="qc-bar__done">{s.success}</span>
                  <span className="qc-bar__total">/ {s.total}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="qc-card">
        <h3 className="qc-card__h">{t('overview.visit')}</h3>
        <QuestGroup title={t('overview.turnIn')} quests={turnIn} lookup={lookup} />
        <QuestGroup title={t('overview.accept')} quests={accept} lookup={lookup} />
        <div className="qc-group">
          <h4 className="qc-group__h">{t('overview.handover')} <span className="qc-group__n">{ready.length}</span></h4>
          <p className="qc-group__hint">{t('overview.handoverHint')}</p>
          {ready.length === 0 ? <p className="qc-muted">{t('overview.nothing')}</p> : (
            <ul className="qc-group__list">
              {ready.map((r) => (
                <li key={r.quest.id}>
                  <QuestLink quest={r.quest} />
                  <span className="qc-muted"> · {lookup.traderName(r.quest.traderId)} · {t('overview.handoverCount', { ready: r.ready, total: r.total })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <QuestTable catalog={catalog} progress={progress} lookup={lookup} traderIds={traderIds} highlight={highlight} />
    </div>
  )
}

function QuestGroup({ title, quests, lookup }: { title: string; quests: CatalogQuest[]; lookup: NameLookup }) {
  const t = useT()
  return (
    <div className="qc-group">
      <h4 className="qc-group__h">{title} <span className="qc-group__n">{quests.length}</span></h4>
      {quests.length === 0 ? <p className="qc-muted">{t('overview.nothing')}</p> : (
        <ul className="qc-group__list">
          {quests.map((q) => (
            <li key={q.id}>
              <QuestLink quest={q} />
              <span className="qc-muted"> · {lookup.traderName(q.traderId)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface QuestTableProps {
  catalog: Catalog
  progress: ProfileProgress
  lookup: NameLookup
  traderIds: string[]
  highlight: ReadonlySet<string>
}

function QuestTable({ catalog, progress, lookup, traderIds, highlight }: QuestTableProps) {
  const t = useT()
  const [tab, setTab] = useState<QuestTab>('active')
  const [traderId, setTraderId] = useState('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const counts = useMemo(() => countTabs(catalog, progress), [catalog, progress])
  const rows = useMemo(
    () => filterProgressQuests(catalog, progress, { tab, traderId, query }),
    [catalog, progress, tab, traderId, query],
  )
  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (!next.delete(id)) next.add(id)
    return next
  })

  return (
    <section className="qc-card qc-card--flush">
      <div className="qc-card__bar">
        <h3 className="qc-card__h">{t('overview.quests')}</h3>
        <div className="qc-chips" role="group" aria-label={t('overview.quests')}>
          {QUEST_TABS.map((k) => (
            <button key={k} type="button" className={cls('qc-chip', tab === k && 'is-on')} aria-pressed={tab === k} onClick={() => setTab(k)}>
              {t(`qtab.${k}`)} {counts[k]}
            </button>
          ))}
        </div>
        <input
          className="qc-search"
          type="search"
          placeholder={t('overview.search')}
          aria-label={t('overview.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="qc-select" aria-label={t('trader.filterLabel')} value={traderId} onChange={(e) => setTraderId(e.target.value)}>
          <option value="">{t('overview.allTraders')}</option>
          {traderIds.map((id) => <option key={id} value={id}>{lookup.traderName(id)}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <p className="qc-empty">{t('overview.empty')}</p> : (
        <ul>
          {rows.map((q) => (
            <QuestLine
              key={q.id}
              quest={q}
              progress={progress}
              lookup={lookup}
              open={expanded.has(q.id)}
              flash={highlight.has(q.id)}
              onToggle={() => toggle(q.id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface QuestLineProps {
  quest: CatalogQuest
  progress: ProfileProgress
  lookup: NameLookup
  open: boolean
  flash: boolean
  onToggle(): void
}

/** 한 줄 요약: 진행 중이면 첫 미완료 목표와 카운터, 잠김이면 첫 잠김 사유. 펼치면 전체. */
function QuestLine({ quest, progress, lookup, open, flash, onToggle }: QuestLineProps) {
  const t = useT()
  const qp = questProgress(progress, quest.id)
  const locked = qp.status === 'Locked'
  const unreachable = locked && isUnreachable(qp)
  const first = firstOpenObjective(quest, qp)
  let summary: string | null = null
  if (locked) summary = qp.lockReasons[0] ? lockReasonText(qp.lockReasons[0], lookup, t) : null
  else if (qp.status === 'Started') summary = first ? lineText(formatObjective(first, t)) : t('overview.allDone')
  const counter = !locked && first ? counterText(qp.objectives[first.conditionId]) : null

  return (
    <li className={cls('qc-pline', open && 'is-open', flash && 'is-flash')}>
      <button type="button" className="qc-pline__row" aria-expanded={open} onClick={onToggle}>
        <span className="qc-pline__name">
          {quest.name}
          {unreachable && <span className="qc-tag qc-pline__tag" title={t('overview.unreachableHint')}>{t('overview.unreachable')}</span>}
        </span>
        <span className="qc-pline__trader">{lookup.traderName(quest.traderId)}</span>
        <span className="qc-pline__summary">{summary}</span>
        <span className="qc-pline__counter">{counter}</span>
      </button>
      {open && (
        <div className="qc-pline__detail">
          {locked && qp.lockReasons.length > 0 && (
            <>
              <h4 className="qc-detail__h">{t('overview.lockReasons')}</h4>
              <ul className="qc-lines">
                {qp.lockReasons.map((r, i) => <li key={i}>{lockReasonText(r, lookup, t)}</li>)}
              </ul>
            </>
          )}
          {quest.objectives.length > 0 && (
            <>
              <h4 className="qc-detail__h">{t('detail.objectives')}</h4>
              <ul className="qc-lines">
                {quest.objectives.map((o) => {
                  const op = qp.objectives[o.conditionId]
                  const c = counterText(op)
                  return (
                    <li key={o.conditionId} className={cls(op?.done && 'is-done')}>
                      <span className="qc-pline__obj">{lineText(formatObjective(o, t))}</span>
                      {c && <span className="qc-pline__counter">{c}</span>}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          <button type="button" className="qc-btn" onClick={() => navigate('wiki', null, { quest: quest.id })}>{t('overview.openWiki')}</button>
        </div>
      )}
    </li>
  )
}

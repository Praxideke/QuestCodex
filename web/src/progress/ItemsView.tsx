import { Fragment, useMemo, useState } from 'react'
import type { Catalog } from '../api/catalog'
import type { Holding, ProfileProgress } from '../api/progress'
import { cls } from '../cls'
import { useT } from '../i18n/I18nContext'
import type { NameLookup } from '../wiki/derive'
import { formatInt } from '../wiki/format'
import { aggregateNeeds, filterNeedRows, ITEM_FILTERS, itemNeeds, missing, sortNeedRows, type ItemFilter, type NeedRow } from './derive'
import { ItemName, QuestLink } from './parts'

interface ItemsViewProps {
  catalog: Catalog
  progress: ProfileProgress
  inventory: Record<string, Holding>
  lookup: NameLookup
}

/** 필요 아이템(I1·I2) — 끝나지 않은 퀘스트가 요구하는 아이템을 합산해 보유와 비교. 행을 펼치면 퀘스트별 내역. */
export function ItemsView({ catalog, progress, inventory }: ItemsViewProps) {
  const t = useT()
  const [filter, setFilter] = useState<ItemFilter>('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const rows = useMemo(
    () => sortNeedRows(aggregateNeeds(itemNeeds(catalog, progress), inventory)),
    [catalog, progress, inventory],
  )
  const counts = useMemo(
    () => Object.fromEntries(ITEM_FILTERS.map((f) => [f, filterNeedRows(rows, f, '').length])) as Record<ItemFilter, number>,
    [rows],
  )
  const visible = useMemo(() => filterNeedRows(rows, filter, query), [rows, filter, query])
  const toggle = (key: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (!next.delete(key)) next.add(key)
    return next
  })

  return (
    <section className="qc-card qc-card--flush qc-items">
      <div className="qc-card__bar">
        <div className="qc-chips" role="group" aria-label={t('filter.label')}>
          {ITEM_FILTERS.map((f) => (
            <button key={f} type="button" className={cls('qc-chip', filter === f && 'is-on')} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {t(`items.filter.${f}`)} {formatInt(counts[f])}
            </button>
          ))}
        </div>
        <input
          className="qc-search"
          type="search"
          placeholder={t('items.search')}
          aria-label={t('items.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="qc-hint qc-items__hint">{t('items.hint')}</p>
      {visible.length === 0 ? <p className="qc-empty">{t('items.empty')}</p> : (
        <table className="qc-table">
          <thead>
            <tr>
              <th>{t('items.col.item')}</th>
              <th className="qc-num">{t('items.col.need')}</th>
              <th className="qc-num">{t('items.col.have')}</th>
              <th className="qc-num">{t('items.col.fir')}</th>
              <th>{t('items.col.quests')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <ItemRow key={r.key} row={r} catalog={catalog} open={expanded.has(r.key)} onToggle={() => toggle(r.key)} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function ItemRow({ row, catalog, open, onToggle }: { row: NeedRow; catalog: Catalog; open: boolean; onToggle(): void }) {
  const t = useT()
  const short = missing(row)
  const questIds = [...new Set(row.sources.map((s) => s.questId))]
  const firstQuest = catalog.quests[questIds[0]]
  return (
    <Fragment>
      <tr className={cls('qc-table__row', open && 'is-open')}>
        <td>
          <button type="button" className="qc-items__toggle" aria-expanded={open} onClick={onToggle}>
            <span className="qc-row__caret">{open ? '▾' : '▸'}</span> <ItemName items={row.items} />
          </button>
          {short > 0 && <span className="qc-warn qc-items__short"> {t('items.short', { n: formatInt(short) })}</span>}
        </td>
        <td className="qc-num">
          {formatInt(row.need)}
          {row.needFir > 0 && <span className="qc-muted qc-items__fir"> {t('items.needFir', { n: formatInt(row.needFir) })}</span>}
        </td>
        <td className="qc-num">{formatInt(row.have)}</td>
        <td className="qc-num">{formatInt(row.haveFir)}</td>
        <td className="qc-items__quests">
          {questIds.length === 1 ? firstQuest?.name : t('items.moreQuests', { name: firstQuest?.name ?? '', n: questIds.length - 1 })}
        </td>
      </tr>
      {open && (
        <tr className="qc-table__detail">
          <td colSpan={5}>
            <ul className="qc-lines">
              {row.sources.map((s) => {
                const q = catalog.quests[s.questId]
                return (
                  <li key={s.conditionId}>
                    {q && <QuestLink quest={q} />}
                    <span className="qc-muted">
                      {' · '}{s.action === 'plant' ? t('prep.plant') : t('prep.handover')} ×{formatInt(s.count)}
                    </span>
                    {s.fir && <span className="qc-prep__fir" title={t('prep.firHint')}>{t('prep.fir')}</span>}
                  </li>
                )
              })}
            </ul>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

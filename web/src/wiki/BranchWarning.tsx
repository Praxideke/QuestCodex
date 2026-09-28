import type { Catalog } from '../api/catalog'
import { useT } from '../i18n/I18nContext'
import type { BranchInfo, NameLookup } from './derive'
import { shortId } from './format'

interface BranchWarningProps {
  branch: BranchInfo
  catalog: Catalog
  lookup: NameLookup
  onJump(questId: string): void
}

/** 펼친 행 맨 위의 택일 분기 경고. 완료 버튼을 누르기 전에 봐야 하는 정보라 목표·보상보다 위에 둔다. */
export function BranchWarning({ branch, catalog, lookup, onJump }: BranchWarningProps) {
  const t = useT()
  const links = (ids: string[]) => <QuestLinks ids={ids} catalog={catalog} lookup={lookup} onJump={onJump} />
  return (
    <div className="qc-branch" role="note">
      <div className="qc-branch__title">⚠ {t('branch.title')}</div>
      {branch.failsOnComplete.length > 0 && (
        <>
          <div className="qc-branch__k">{t('branch.failsOnComplete')}</div>
          {links(branch.failsOnComplete)}
        </>
      )}
      {branch.failedBy.length > 0 && (
        <>
          <div className="qc-branch__k">{t('branch.failedBy')}</div>
          {links(branch.failedBy)}
        </>
      )}
      {branch.blocked.length > 0 && (
        <details className="qc-extra">
          <summary>{t('branch.blocked', { n: branch.blocked.length })}</summary>
          {links(branch.blocked)}
        </details>
      )}
      {branch.opened.length > 0 && (
        <details className="qc-extra">
          <summary>{t('branch.opened', { n: branch.opened.length })}</summary>
          {links(branch.opened)}
        </details>
      )}
    </div>
  )
}

function QuestLinks({ ids, catalog, lookup, onJump }: { ids: string[]; catalog: Catalog; lookup: NameLookup; onJump(questId: string): void }) {
  const t = useT()
  return (
    <div className="qc-branch__links">
      {ids.map((id) => {
        const target = catalog.quests[id]
        if (!target) return <span key={id} className="qc-warn">{t('fmt.unknownQuest', { id: shortId(id) })}</span>
        return (
          <button key={id} type="button" className="qc-link" onClick={() => onJump(id)}>
            {target.name}
            <span className="qc-related__who">{lookup.traderName(target.traderId)}</span>
          </button>
        )
      })}
    </div>
  )
}

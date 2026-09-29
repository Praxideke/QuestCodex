import type { ProfileProgress, ProfileSummary } from '../api/progress'
import { useT } from '../i18n/I18nContext'

interface ProfileBarProps {
  profiles: ProfileSummary[]
  profileId: string | null
  onSelect(id: string): void
  progress: ProfileProgress | null
  loading: boolean
  updatedAt: Date | null
  onRefresh(): void
}

/** 진행현황 영역 상단에 한 번 (C1). 위키에는 없다. */
export function ProfileBar({ profiles, profileId, onSelect, progress, loading, updatedAt, onRefresh }: ProfileBarProps) {
  const t = useT()
  if (profiles.length === 0) return null
  return (
    <div className="qc-profile">
      <select
        className="qc-select"
        aria-label={t('profile.label')}
        value={profileId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nickname}{p.level !== null ? ` · ${t('profile.level', { n: p.level })}` : ''}
          </option>
        ))}
      </select>
      {progress && (
        <span className="qc-profile__meta">
          {t('profile.level', { n: progress.level })} · {progress.side.toUpperCase()}
          {progress.isActive && <span className="qc-profile__online"> ● {t('profile.online')}</span>}
        </span>
      )}
      <span className="qc-profile__spacer" />
      <span className="qc-profile__updated" aria-live="polite">
        {loading ? t('topbar.busy') : updatedAt && t('profile.updated', { time: updatedAt.toLocaleTimeString() })}
      </span>
      <button type="button" className="qc-btn" onClick={onRefresh} disabled={loading}>{t('profile.refresh')}</button>
    </div>
  )
}

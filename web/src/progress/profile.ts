import type { ProfileSummary } from '../api/progress'
import { safeStorage } from '../shell/storage'

const KEY = 'questcodex.profile'

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>

/**
 * 보여 줄 프로필: 저장한 것이 목록에 있으면 그것, 아니면 첫 번째 — 서버가 접속 중 → 최근 레이드 순으로 정렬해 주므로
 * 첫 번째가 곧 "접속 중인 프로필" 이다(C1). 목록이 비면 null.
 */
export function pickProfile(profiles: ProfileSummary[], saved: string | null): string | null {
  if (saved !== null && profiles.some((p) => p.id === saved)) return saved
  return profiles[0]?.id ?? null
}

export function loadProfile(storage: ReadStorage | null = safeStorage()): string | null {
  try {
    return storage?.getItem(KEY) ?? null
  } catch {
    return null
  }
}

export function saveProfile(id: string, storage: WriteStorage | null = safeStorage()): void {
  try {
    storage?.setItem(KEY, id)
  } catch {
    // 저장 실패는 무시 — 다음 방문에 접속 중 프로필로 돌아갈 뿐
  }
}

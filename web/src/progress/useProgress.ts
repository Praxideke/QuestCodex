import { useCallback, useEffect, useRef, useState } from 'react'
import { CatalogError } from '../api/catalog'
import { subscribeMessages } from '../api/messages'
import { fetchProfiles, fetchProgress, type ProfileProgress, type ProfileSummary } from '../api/progress'
import { loadProfile, pickProfile, saveProfile } from './profile'

/** 푸시로 바뀐 퀘스트를 강조하는 시간 */
const HIGHLIGHT_MS = 4000

function errorCode(err: unknown): string {
  return err instanceof CatalogError ? err.code : 'network'
}

/**
 * 프로필 목록 + 선택한 프로필의 진행 상태(C1·C2). 진행현황 페이지가 마운트돼 있는 동안만 산다 —
 * 위키로 가면 구독도 풀린다.
 *
 * 다시 요청하는 때: 프로필을 바꿀 때, 그 프로필의 profileUpdated 푸시(레이드 종료·수락·완료·제출), 탭으로 돌아올 때
 * (상인·플리 구매와 은신처 조작은 푸시가 없어 이것으로 보완), 새로고침 버튼.
 */
export function useProgress() {
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null)
  const [profileId, setProfileIdState] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProfileProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [highlight, setHighlight] = useState<ReadonlySet<string>>(() => new Set())
  const [attempt, setAttempt] = useState(0)
  const highlightTimer = useRef<number | undefined>(undefined)

  // 프로필 목록: 마운트·재시도 때
  useEffect(() => {
    const ctrl = new AbortController()
    fetchProfiles(ctrl.signal)
      .then((list) => {
        setProfiles(list)
        setProfileIdState((cur) => cur ?? pickProfile(list, loadProfile()))
        if (list.length === 0) setLoading(false)
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        setError(errorCode(err))
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [attempt])

  // 진행 상태: 프로필이 정해질 때·refresh 때. 이전 응답은 새 응답이 올 때까지 유지해 깜빡이지 않게 한다.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (profileId === null) return
    const ctrl = new AbortController()
    setLoading(true)
    fetchProgress(profileId, ctrl.signal)
      .then((p) => {
        setProgress(p)
        setError(null)
        setUpdatedAt(new Date())
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        setError(errorCode(err))
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [profileId, tick])

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => subscribeMessages((msg) => {
    if (msg.profileId !== profileId) return
    refresh()
    if (msg.changedQuestIds && msg.changedQuestIds.length > 0) {
      setHighlight(new Set(msg.changedQuestIds))
      window.clearTimeout(highlightTimer.current)
      highlightTimer.current = window.setTimeout(() => setHighlight(new Set()), HIGHLIGHT_MS)
    }
  }), [profileId, refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  useEffect(() => () => window.clearTimeout(highlightTimer.current), [])

  const setProfileId = useCallback((id: string) => {
    saveProfile(id)
    setProgress(null)       // 다른 사람의 진행을 잠깐이라도 보여 주지 않는다
    setProfileIdState(id)
  }, [])

  /** 목록부터 다시 — 목록 요청이 실패했을 때의 재시도 */
  const retry = useCallback(() => {
    setError(null)
    setLoading(true)
    if (profiles === null) setAttempt((n) => n + 1)
    else refresh()
  }, [profiles, refresh])

  return { profiles, profileId, setProfileId, progress, loading, error, updatedAt, highlight, refresh, retry }
}

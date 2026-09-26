import { useEffect, useState } from 'react'

// 위치정보 팝업(QuestMapDialog)이 쓰는 범용 상태 훅. React 없이 테스트할 로직이 없어 단위 테스트는 없다.

/**
 * localStorage 에 저장되는 켜기/끄기 값. 저장값이 없으면 defaultValue. localStorage 가 막힌 환경(시크릿 창 등)에서는
 * defaultValue 로 시작하고 저장만 건너뛴다 — useDialogFrame 의 저장 방식과 같다.
 */
export function usePersistedFlag(storageKey: string, defaultValue: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved === null ? defaultValue : saved === '1'
    } catch { return defaultValue }
  })
  const set = (v: boolean) => {
    setValue(v)
    try { localStorage.setItem(storageKey, v ? '1' : '0') } catch { /* 저장 못 해도 이번 세션 동작엔 지장 없음 */ }
  }
  return [value, set]
}

/** 비동기 로드 한 건. load 가 null 이면 아무것도 하지 않는다. deps 가 바뀌면 이전 결과를 버린다. */
export function useLoaded<V>(load: (() => Promise<V>) | null, deps: unknown[]): { data: V | null; failed: boolean } {
  const [state, setState] = useState<{ data: V | null; failed: boolean }>({ data: null, failed: false })
  useEffect(() => {
    if (!load) return
    let alive = true
    setState({ data: null, failed: false })
    load().then(
      (data) => { if (alive) setState({ data, failed: false }) },
      () => { if (alive) setState({ data: null, failed: true }) },
    )
    return () => { alive = false }
  }, deps)
  return state
}

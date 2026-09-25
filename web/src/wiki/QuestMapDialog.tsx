import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { CatalogQuest } from '../api/catalog'
import { useT } from '../i18n/I18nContext'
import type { T, UiKey } from '../i18n/index'
import { formatObjective, lineText } from './format'
import { loadMapDef, loadMapIndex, mapAssetUrl } from './mapAssets'
import {
  buildTabs, fitView, layerFor, layerStyle, markerCountsByLevel, numberedObjectives, project, zoomAt,
  type MapDef, type MapIndex, type MapTab, type Marker, type View,
} from './mapProjection'
import { useDialogFrame } from './useDialogFrame'

interface QuestMapDialogProps {
  /** null 이면 닫힘. QuestPrepDialog 와 같은 showModal()/close() 토글. */
  quest: CatalogQuest | null
  traderName: string
  onClose(): void
}

/** 위치정보 팝업. 맵 탭 → [지도(층 버튼·마커) | 목표 목록], 아래에 지도 출처. */
export function QuestMapDialog({ quest, traderName, onClose }: QuestMapDialogProps) {
  const t = useT()
  const ref = useRef<HTMLDialogElement>(null)
  const frame = useDialogFrame(ref, 'map', quest !== null, onClose)
  const index = useLoaded(quest ? loadMapIndex : null, [quest !== null])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (quest && !el.open) el.showModal()
    else if (!quest && el.open) el.close()
  }, [quest])

  return (
    <dialog ref={ref} className="qc-dialog qc-dialog--map" onClose={onClose} {...frame.dialogProps}>
      {frame.grips}
      {quest && (
        <header className="qc-dialog__head" {...frame.headProps}>
          <button type="button" className="qc-dialog__close" aria-label={t('dialog.close')} onClick={onClose}>✕</button>
          <h3 className="qc-dialog__title">{t('map.button')} · {quest.name}</h3>
          <p className="qc-dialog__meta">{traderName}</p>
        </header>
      )}
      {quest && (index.failed
        ? <p className="qc-map__msg qc-warn">{t('map.loadError')}</p>
        : index.data
          // key: 다른 퀘스트로 다시 열면 탭·층·확대 상태를 초기화한다
          ? <MapBody key={quest.id} quest={quest} index={index.data} />
          : <p className="qc-map__msg">{t('map.loading')}</p>)}
    </dialog>
  )
}

function MapBody({ quest, index }: { quest: CatalogQuest; index: MapIndex }) {
  const t = useT()
  const tabs = useMemo(() => buildTabs(quest.objectives, index), [quest, index])
  const numbered = useMemo(() => numberedObjectives(quest.objectives), [quest])
  const [tabKey, setTabKey] = useState<string | null>(tabs[0]?.key ?? null)
  const [chosenLevel, setChosenLevel] = useState<number | null>(null)
  const [view, setView] = useState<View>(fitView)
  const [hot, setHot] = useState<number | null>(null)
  const tab = tabs.find((x) => x.key === tabKey) ?? null
  const def = useLoaded(tabKey ? () => loadMapDef(tabKey) : null, [tabKey])

  // 처음 열 때·탭을 바꿀 때는 첫 마커가 있는 층을 보여 준다
  const level = chosenLevel ?? (def.data && tab && tab.markers.length > 0 ? layerFor(def.data, tab.markers[0].point).level : 0)
  const markersHere = def.data && tab ? tab.markers.filter((m) => layerFor(def.data!, m.point).level === level) : []

  function selectTab(key: string) {
    setTabKey(key)
    setChosenLevel(null)
    setView(fitView())
    setHot(null)
  }

  return (
    <>
      {tabs.length > 0 && (
        <div className="qc-map__tabs" role="tablist">
          {tabs.map((x) => (
            <button
              key={x.key} type="button" role="tab" aria-selected={x.key === tabKey}
              className={x.key === tabKey ? 'qc-map__tab is-on' : 'qc-map__tab'}
              onClick={() => selectTab(x.key)}
            >
              {mapName(x.key, t)}
            </button>
          ))}
        </div>
      )}
      <div className="qc-map__body">
        <div className="qc-map__stage">
          {!tab && <p className="qc-map__msg">{t('map.noMapDef')}</p>}
          {tab && def.failed && <p className="qc-map__msg qc-warn">{t('map.loadError')}</p>}
          {tab && !def.failed && !def.data && <p className="qc-map__msg">{t('map.loading')}</p>}
          {tab && def.data && (
            <MapCanvas
              mapKey={tab.key} def={def.data} tab={tab} level={level} markers={markersHere}
              view={view} onView={setView} onLevel={(l) => { setChosenLevel(l); setHot(null) }}
              hot={hot} onHot={setHot}
            />
          )}
        </div>
        <aside className="qc-map__side">
          <h4 className="qc-detail__h">{t('map.objectives', { n: numbered.length })}</h4>
          <ol className="qc-map__list">
            {numbered.map(({ n, objective }) => {
              const here = markersHere.some((m) => m.n === n)
              return (
                <li
                  key={objective.conditionId}
                  className={[hot === n && 'is-hot', !here && 'is-off'].filter(Boolean).join(' ')}
                  onMouseEnter={() => setHot(n)}
                  onMouseLeave={() => setHot(null)}
                >
                  <span className="qc-map__num">{n}</span>
                  <span>{lineText(formatObjective(objective, t))}</span>
                </li>
              )
            })}
          </ol>
          <p className="qc-map__hint">{t('map.hint')}</p>
        </aside>
      </div>
      {tab && def.data && <Credit def={def.data} />}
    </>
  )
}

interface MapCanvasProps {
  mapKey: string
  def: MapDef
  tab: MapTab
  level: number
  markers: Marker[]
  view: View
  onView(update: (v: View) => View): void
  onLevel(level: number): void
  hot: number | null
  onHot(n: number | null): void
}

/**
 * 층 SVG 를 겹친 캔버스를 뷰포트 안에 "contain" 으로 맞추고, CSS transform 으로 확대·이동한다.
 * 마커는 캔버스 안에 % 로 두고 1/배율로 되돌려 크기가 화면 기준으로 일정하다.
 */
function MapCanvas({ mapKey, def, tab, level, markers, view, onView, onLevel, hot, onHot }: MapCanvasProps) {
  const t = useT()
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x0: number; y0: number; v: View } | null>(null)
  const base = def.layers.find((l) => l.level === def.defaultLevel) ?? def.layers[0]
  const counts = useMemo(() => markerCountsByLevel(def, tab.markers), [def, tab])
  const floors = [...def.layers].sort((a, b) => b.level - a.level)

  // React 의 onWheel 은 passive 라 preventDefault 로 페이지 스크롤을 막을 수 없다 — 네이티브로 붙인다.
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      e.preventDefault()
      const r = vp.getBoundingClientRect()
      // 캔버스의 변환 전 원점(offsetLeft/Top) 기준 좌표. transform 은 offset 에 영향을 주지 않는다.
      const cx = e.clientX - r.left - canvas.offsetLeft
      const cy = e.clientY - r.top - canvas.offsetTop
      onView((v) => zoomAt(v, e.deltaY < 0 ? 1.25 : 0.8, cx, cy))
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [onView])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, v: view }
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    onView(() => ({ ...d.v, x: d.v.x + e.clientX - d.x0, y: d.v.y + e.clientY - d.y0 }))
  }
  const endDrag = () => { drag.current = null }

  return (
    <div
      ref={viewportRef}
      className="qc-map__viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button')) onView(fitView) }}
    >
      <div
        ref={canvasRef}
        className="qc-map__canvas"
        style={{
          ['--ar' as string]: base.viewBox.width / base.viewBox.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        {def.layers.map((layer) => {
          const s = layerStyle(layer.level, level, def.defaultLevel)
          if (!s.visible) return null
          return (
            <img
              key={layer.svg} className="qc-map__layer" src={mapAssetUrl(mapKey, layer.svg)} alt="" draggable={false}
              style={{ filter: s.brightness < 1 ? `brightness(${s.brightness})` : undefined, opacity: s.opacity }}
            />
          )
        })}
        {markers.map((m, i) => {
          const layer = layerFor(def, m.point)
          const p = project(def, layer, m.point)
          return (
            <span
              key={i}
              className={hot === m.n ? 'qc-map__marker is-hot' : 'qc-map__marker'}
              style={{
                left: `${(p.x / layer.viewBox.width) * 100}%`,
                top: `${(p.y / layer.viewBox.height) * 100}%`,
                transform: `translate(-50%, -50%) scale(${1 / view.scale})`,
              }}
              onMouseEnter={() => onHot(m.n)}
              onMouseLeave={() => onHot(null)}
            >
              {m.n}
            </span>
          )
        })}
      </div>
      {floors.length > 1 && (
        <div className="qc-map__floors" role="group" aria-label={t('map.floors')}>
          {floors.map((f) => {
            const n = counts.get(f.level) ?? 0
            return (
              <button
                key={f.level} type="button"
                className={f.level === level ? 'qc-map__floor is-on' : 'qc-map__floor'}
                aria-pressed={f.level === level}
                onClick={() => onLevel(f.level)}
              >
                {floorName(f.level, t)}
                {n > 0 && <span className="qc-map__count">{n}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * 지도 출처(스펙 §5): 원저작자, 수정자, 라이선스, 보정 데이터(DynamicMaps, MIT). 원본 라이선스 파일(.md)은 맵 폴더에
 * 동봉하지만 링크는 CC 원문으로 건다 — 정적 파일 서버가 모르는 확장자(.md)는 서빙하지 않을 수 있다.
 */
const CC_BY_NC_SA = 'https://creativecommons.org/licenses/by-nc-sa/4.0/'

function Credit({ def }: { def: MapDef }) {
  const t = useT()
  const a = def.attribution
  const author = a.modifiedBy ? `${a.author}, ${t('map.modifiedBy', { name: a.modifiedBy })}` : a.author
  return (
    <footer className="qc-map__credit">
      {t('map.credit', { author, license: a.license })}
      {' · '}
      <a href={CC_BY_NC_SA} target="_blank" rel="noreferrer">{t('map.license')}</a>
    </footer>
  )
}

const MAP_NAMES = new Set([
  'bigmap', 'factory4_day', 'sandbox', 'interchange', 'laboratory', 'labyrinth',
  'lighthouse', 'rezervbase', 'shoreline', 'tarkovstreets', 'woods',
])

/** 탭 이름. 번역이 없는 새 맵 폴더면 폴더 키 그대로. */
function mapName(key: string, t: T): string {
  return MAP_NAMES.has(key) ? t(`map.name.${key}` as UiKey) : key
}

function floorName(level: number, t: T): string {
  if (level < 0) return t('map.floor.underground')
  if (level === 0) return t('map.floor.ground')
  return t('map.floor.upper', { n: level + 1 })
}

/** 비동기 로드 한 건. load 가 null 이면 아무것도 하지 않는다. deps 가 바뀌면 이전 결과를 버린다. */
function useLoaded<V>(load: (() => Promise<V>) | null, deps: unknown[]): { data: V | null; failed: boolean } {
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

import { useEffect, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { LockedDoor, MapPoint } from '../api/catalog'
import { useT } from '../i18n/I18nContext'
import type { T } from '../i18n/index'
import { mapAssetUrl } from './mapAssets'
import {
  areaPolygon, fitView, floorsWithOtherMarkers, layerFor, layerStyle, markerCountsByLevel, project, zoomAt,
  type AreaMarker, type MapDef, type MapTab, type Marker, type View,
} from './mapProjection'

interface MapCanvasProps {
  mapKey: string
  def: MapDef
  tab: MapTab
  level: number
  /** 현재 층의 퀘스트 마커 */
  markers: Marker[]
  /** 현재 층의 잠긴 문. 토글이 꺼져 있으면 빈 배열. */
  doors: LockedDoor[]
  /** 현재 층의 구역 영역(구역 처치·신호탄, 08 스펙) */
  areas: AreaMarker[]
  view: View
  onView(update: (v: View) => View): void
  onLevel(level: number): void
  hot: number | null
  onHot(n: number | null): void
}

/**
 * 층 SVG 를 겹친 캔버스를 뷰포트 안에 "contain" 으로 맞추고, CSS transform 으로 확대·이동한다.
 * 마커는 캔버스 안에 % 로 두고 1/배율로 되돌려 크기가 화면 기준으로 일정하다.
 * 쌓임 순서: 지도 < 구역 영역 < 잠긴 문 < 퀘스트 마커 < 층 버튼.
 */
export function MapCanvas({ mapKey, def, tab, level, markers, doors, areas, view, onView, onLevel, hot, onHot }: MapCanvasProps) {
  const t = useT()
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x0: number; y0: number; v: View } | null>(null)
  const base = def.layers.find((l) => l.level === def.defaultLevel) ?? def.layers[0]
  const dotted = useMemo(() => floorsWithOtherMarkers(markerCountsByLevel(def, tab.markers, tab.areas), level), [def, tab, level])
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

  /** 마커 공통 배치: 점이 속한 층 SVG 기준 % 위치 + 배율 되돌리기 */
  const place = (point: MapPoint) => {
    const layer = layerFor(def, point)
    const p = project(def, layer, point)
    return {
      left: `${(p.x / layer.viewBox.width) * 100}%`,
      top: `${(p.y / layer.viewBox.height) * 100}%`,
      transform: `translate(-50%, -50%) scale(${1 / view.scale})`,
    }
  }

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
        {areas.length > 0 && (
          // 영역은 기본 층 SVG 와 같은 viewBox 의 SVG 한 장에 그린다. 층마다 imageBounds 가 같아서 한 좌표계로 충분하다.
          <svg className="qc-map__areas" viewBox={`0 0 ${base.viewBox.width} ${base.viewBox.height}`} preserveAspectRatio="none" aria-hidden>
            {areas.map((a, i) => (
              <polygon
                key={i}
                className={hot === a.n ? 'qc-map__area is-hot' : 'qc-map__area'}
                points={areaPolygon(def, base, a.area).map((p) => `${p.x},${p.y}`).join(' ')}
              />
            ))}
          </svg>
        )}
        {doors.map((d, i) => <DoorMarker key={`d${i}`} door={d} style={place(d.position)} />)}
        {markers.map((m, i) => (
          <span
            key={i}
            className={hot === m.n ? 'qc-map__marker is-hot' : 'qc-map__marker'}
            style={place(m.point)}
            onMouseEnter={() => onHot(m.n)}
            onMouseLeave={() => onHot(null)}
          >
            {m.n}
          </span>
        ))}
      </div>
      {floors.length > 1 && (
        <div className="qc-map__floors" role="group" aria-label={t('map.floors')}>
          {floors.map((f) => {
            const dot = dotted.has(f.level)
            const name = floorName(f.level, t)
            return (
              <button
                key={f.level} type="button"
                className={f.level === level ? 'qc-map__floor is-on' : 'qc-map__floor'}
                aria-pressed={f.level === level}
                aria-label={dot ? `${name} · ${t('map.floorHasMarkers')}` : name}
                onClick={() => onLevel(f.level)}
              >
                {name}
                {dot && <span className="qc-map__dot" aria-hidden />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface DoorMarkerProps {
  door: LockedDoor
  style: CSSProperties
  /**
   * 보유 열쇠 표시 자리(06 스펙 §4.3). 위키는 프로필과 무관해서 지금은 넘기는 곳이 없다 — 진행현황 페이지에서
   * 프로필 인벤토리와 door.keyTpl 을 대조해 넘기면 is-owned / is-missing 클래스가 붙는다.
   */
  owned?: boolean
}

/**
 * 잠긴 문: DynamicMaps 아이콘(흰 도형 + 검은 외곽선)에 DynamicMaps 처럼 색을 곱한다 — 흰 부분만 물들고 외곽선은
 * 검은 채로 남는다(LockedDoorMarkerMutator: 열쇠 없음 빨강, 보유 초록 + 열쇠 아이콘). 위키는 보유 여부를 모르므로
 * 기본은 빨강 자물쇠. 마우스를 올리면 열쇠 이름 말풍선(CSS :hover).
 */
function DoorMarker({ door, style, owned }: DoorMarkerProps) {
  const t = useT()
  const icon = mapAssetUrl('icons', owned ? 'door_with_key.png' : 'door_with_lock.png')
  const state = owned === undefined ? '' : owned ? ' is-owned' : ' is-missing'
  const label = door.kind === 'keycard' ? `${t('map.keycard')} · ${door.keyName}` : door.keyName
  return (
    <span className={`qc-map__door${state}`} style={{ ...style, ['--icon' as string]: `url("${icon}")` }}>
      <img src={icon} alt={label} draggable={false} />
      <span className="qc-map__tint" aria-hidden />
      <span className="qc-map__tip" role="tooltip">{label}</span>
    </span>
  )
}

function floorName(level: number, t: T): string {
  if (level < 0) return t('map.floor.underground')
  if (level === 0) return t('map.floor.ground')
  return t('map.floor.upper', { n: level + 1 })
}

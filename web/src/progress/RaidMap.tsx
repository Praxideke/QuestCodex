import { useMemo, useState } from 'react'
import type { LockedDoor } from '../api/catalog'
import { useT } from '../i18n/I18nContext'
import { MapCanvas } from '../wiki/MapCanvas'
import { loadMapDef, loadMapIndex } from '../wiki/mapAssets'
import { areaLevels, buildNumberedTabs, doorsForTab, firstLevel, fitView, layerFor, mapKeyFor, markerLevels, type MapIndex, type MapTab, type View } from '../wiki/mapProjection'
import { Credit } from '../wiki/QuestMapDialog'
import { useLoaded, usePersistedFlag } from '../wiki/useMapState'
import type { RaidMapPlan } from './derive'

interface RaidMapProps {
  /** 고른 맵(서버 맵 키, 상단 맵 탭) */
  map: string
  mapLabel: string
  plan: RaidMapPlan
  /** catalog.lockedDoors — 구버전 서버면 undefined */
  lockedDoors: Record<string, LockedDoor[]> | undefined
  /** 강조할 퀘스트 번호 — 목록 줄과 지도 마커가 같은 값을 공유한다 */
  hot: number | null
  onHot(n: number | null): void
}

/**
 * 레이드 준비의 위치 지도. 위키 위치정보 팝업(QuestMapDialog)의 지도 부분과 같지만 맵 탭·목표 목록이 없다 —
 * 맵은 상단 맵 탭이 정하고, 목록은 "이 맵에서 진행되는 퀘스트" 카드가 대신한다(번호 = 퀘스트).
 */
export function RaidMap({ map, mapLabel, plan, lockedDoors, hot, onHot }: RaidMapProps) {
  const t = useT()
  const index = useLoaded(loadMapIndex, [])
  const [showDoors, setShowDoors] = usePersistedFlag('qc.map.showDoors', true)
  const key = index.data ? mapKeyFor(index.data, map) : null
  const doors = useMemo(() => (index.data && key ? doorsForTab(lockedDoors, index.data, key) : []), [lockedDoors, index.data, key])

  return (
    <section className="qc-card qc-raidmap">
      <div className="qc-raidmap__head">
        <h3 className="qc-card__h">{t('raid.map', { map: mapLabel })}</h3>
        <button
          type="button"
          className={showDoors && doors.length > 0 ? 'qc-map__toggle is-on' : 'qc-map__toggle'}
          aria-pressed={showDoors}
          disabled={doors.length === 0}
          title={doors.length === 0 ? t('map.doorsNone') : undefined}
          onClick={() => setShowDoors(!showDoors)}
        >
          {t('map.doors')}
        </button>
      </div>
      {index.failed && <p className="qc-map__msg qc-warn">{t('map.loadError')}</p>}
      {!index.failed && !index.data && <p className="qc-map__msg">{t('map.loading')}</p>}
      {index.data && key === null && <p className="qc-map__msg">{t('raid.mapNone')}</p>}
      {index.data && key !== null && (
        // key: 맵을 바꾸면 층·확대 상태를 초기화한다
        <MapView key={key} mapKey={key} index={index.data} plan={plan} doors={showDoors ? doors : []} hot={hot} onHot={onHot} />
      )}
    </section>
  )
}

interface MapViewProps {
  mapKey: string
  index: MapIndex
  plan: RaidMapPlan
  doors: LockedDoor[]
  hot: number | null
  onHot(n: number | null): void
}

function MapView({ mapKey, index, plan, doors, hot, onHot }: MapViewProps) {
  const t = useT()
  const tab: MapTab = useMemo(
    () => buildNumberedTabs(plan.items, index).find((x) => x.key === mapKey) ?? { key: mapKey, markers: [], areas: [] },
    [plan, index, mapKey],
  )
  const [chosenLevel, setChosenLevel] = useState<number | null>(null)
  const [view, setView] = useState<View>(fitView)
  const def = useLoaded(() => loadMapDef(mapKey), [mapKey])
  const map = def.data
  const level = chosenLevel ?? (map ? firstLevel(map, tab) : 0)
  // 층 거르기는 위키 팝업과 같은 규칙(영역이 있는 목표의 마커는 영역의 층, 08 스펙 §3.2)
  const markersHere = map ? tab.markers.filter((m) => markerLevels(map, m, tab.areas).has(level)) : []
  const doorsHere = map ? doors.filter((d) => layerFor(map, d.position).level === level) : []
  const areasHere = map ? tab.areas.filter((a) => areaLevels(map, a.area).has(level)) : []

  if (def.failed) return <p className="qc-map__msg qc-warn">{t('map.loadError')}</p>
  if (!map) return <p className="qc-map__msg">{t('map.loading')}</p>
  return (
    <>
      <div className="qc-raidmap__stage">
        <MapCanvas
          mapKey={mapKey} def={map} tab={tab} level={level} markers={markersHere} doors={doorsHere} areas={areasHere}
          view={view} onView={setView} onLevel={(l) => { setChosenLevel(l); onHot(null) }}
          hot={hot} onHot={onHot}
        />
      </div>
      <p className="qc-map__hint">{t('map.hint')}</p>
      <Credit def={map} />
    </>
  )
}

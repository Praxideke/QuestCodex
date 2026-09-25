import type { MapPoint, Objective } from '../api/catalog'

// 위치정보 팝업의 계산부. React 없이 테스트된다(mapProjection.test.ts).
// 맵 정의(public/maps/<key>/map.json)는 tools/maps/build-maps.js 가 DynamicMaps 의 jsonc 에서 만든 것이고,
// 축 이름은 이미 Unity 기준(y = 높이)으로 바뀌어 있다. 계산은 DynamicMaps MapView/MapLayer 와 같다.

export interface FlatPoint { x: number; z: number }
export interface Bounds3 { min: MapPoint; max: MapPoint }

export interface MapLayerDef {
  name: string
  level: number
  svg: string
  viewBox: { width: number; height: number }
  imageBounds: { min: FlatPoint; max: FlatPoint }
  gameBounds: Bounds3[]
}

export interface MapAttribution {
  author: string
  authorLink: string
  modifiedBy: string | null
  license: string
  licenseFile: string
}

export interface MapDef {
  displayName: string
  internalNames: string[]
  coordinateRotation: number
  defaultLevel: number
  layers: MapLayerDef[]
  attribution: MapAttribution
  source: string
}

export interface MapIndex {
  maps: { key: string; internalNames: string[] }[]
}

/** 마커 하나. n = 위치가 있는 목표 중 몇 번째인가(1부터). 한 목표에 점이 여럿이면 같은 n 이 여럿. */
export interface Marker {
  n: number
  conditionId: string
  point: MapPoint
}

export interface MapTab {
  /** 맵 폴더 키(public/maps/<key>) */
  key: string
  markers: Marker[]
}

/** Unity (x, z) 를 반시계로 deg 만큼 돌린다. */
function rotate(x: number, z: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return [x * cos - z * sin, x * sin + z * cos]
}

/**
 * Unity 좌표 → 층 SVG 의 viewBox 좌표. 회전한 imageBounds 네 꼭짓점의 범위를 SVG 전체에 비례 대응시킨다.
 * SVG 는 y 가 아래로 커지므로 세로는 뒤집는다.
 */
export function project(def: MapDef, layer: MapLayerDef, p: MapPoint): { x: number; y: number } {
  const { min, max } = layer.imageBounds
  const corners = [[min.x, min.z], [min.x, max.z], [max.x, min.z], [max.x, max.z]]
    .map(([x, z]) => rotate(x, z, def.coordinateRotation))
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const [rx, ry] = rotate(p.x, p.z, def.coordinateRotation)
  return {
    x: ((rx - minX) / (maxX - minX)) * layer.viewBox.width,
    y: ((maxY - ry) / (maxY - minY)) * layer.viewBox.height,
  }
}

const contains = (b: Bounds3, p: MapPoint) =>
  p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y && p.z >= b.min.z && p.z <= b.max.z

const volume = (b: Bounds3) => (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z)

/** 점이 속한 층: 점을 포함하는 gameBounds 중 부피가 가장 작은 것의 층. 어디에도 없으면 기본 층. */
export function layerFor(def: MapDef, p: MapPoint): MapLayerDef {
  let best: MapLayerDef | null = null
  let bestVolume = Infinity
  for (const layer of def.layers) {
    for (const b of layer.gameBounds) {
      if (contains(b, p) && volume(b) < bestVolume) {
        best = layer
        bestVolume = volume(b)
      }
    }
  }
  return best ?? defaultLayer(def)
}

export function defaultLayer(def: MapDef): MapLayerDef {
  return def.layers.find((l) => l.level === def.defaultLevel) ?? def.layers[0]
}

/**
 * 층 SVG 를 겹쳐 그리는 방식(DynamicMaps MapLayer.OnTopLevelSelected). 층 SVG 에는 그 층의 도형만 있어서
 * 2층만 그리면 건물 조각만 떠 보인다 — 아래층을 어둡게 깔아 준다.
 */
export function layerStyle(level: number, selected: number, defaultLevel: number) {
  const brightness = Math.min(1, 0.5 ** (selected - level))
  if (level <= selected) return { visible: true, brightness, opacity: 1 }
  if (level === defaultLevel) return { visible: true, brightness, opacity: 0.1 }
  return { visible: false, brightness, opacity: 1 }
}

/** 서버 맵 키(bigmap, sandbox_high …) → 맵 폴더 키. internalNames 와 대소문자를 무시하고 대조한다. */
export function mapKeyFor(index: MapIndex, map: string): string | null {
  const m = map.toLowerCase()
  return index.maps.find((d) => d.internalNames.some((n) => n.toLowerCase() === m))?.key ?? null
}

/**
 * 목표들의 위치를 맵 정의 단위 탭으로 묶는다. 탭 순서 = 목표 순서에서 처음 나온 순. 정의가 없는 맵은 버린다.
 * 짝 맵(factory4_day·night, sandbox·sandbox_high)은 한 탭이 되는데, 같은 존이 양쪽에 같은 좌표로 있는 경우가
 * 대부분이라 같은 목표의 같은 점은 한 번만 넣는다 — 안 그러면 마커가 겹쳐 찍히고 층 버튼 개수가 두 배가 된다.
 */
export function buildTabs(objectives: Objective[], index: MapIndex): MapTab[] {
  const tabs = new Map<string, Marker[]>()
  let n = 0
  for (const o of objectives) {
    const locations = o.locations ?? []
    if (locations.length === 0) continue
    n++
    for (const loc of locations) {
      const key = mapKeyFor(index, loc.map)
      if (key === null) continue
      if (!tabs.has(key)) tabs.set(key, [])
      const markers = tabs.get(key)!
      for (const point of loc.points) {
        const dup = markers.some((m) => m.n === n && m.point.x === point.x && m.point.y === point.y && m.point.z === point.z)
        if (!dup) markers.push({ n, conditionId: o.conditionId, point })
      }
    }
  }
  return [...tabs].map(([key, markers]) => ({ key, markers }))
}

/** 위치가 있는 목표만, 마커 번호와 함께 */
export function numberedObjectives(objectives: Objective[]): { n: number; objective: Objective }[] {
  return objectives.filter((o) => (o.locations ?? []).length > 0).map((objective, i) => ({ n: i + 1, objective }))
}

/** 층 버튼의 개수 표시: level → 그 층에 찍힐 마커 수 */
export function markerCountsByLevel(def: MapDef, markers: Marker[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const m of markers) {
    const level = layerFor(def, m.point).level
    counts.set(level, (counts.get(level) ?? 0) + 1)
  }
  return counts
}

/** 확대·이동 상태. 내용(지도) 좌표 c 는 화면에서 c * scale + (x, y) 에 그려진다. */
export interface View { scale: number; x: number; y: number }

const MIN_SCALE = 1
const MAX_SCALE = 12

export function fitView(): View {
  return { scale: 1, x: 0, y: 0 }
}

/** 화면 좌표 (cx, cy) 아래의 지점을 고정한 채 factor 배 확대·축소한다. 1배로 돌아오면 이동도 초기화한다. */
export function zoomAt(v: View, factor: number, cx: number, cy: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
  if (scale === MIN_SCALE) return fitView()
  const k = scale / v.scale
  return { scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
}

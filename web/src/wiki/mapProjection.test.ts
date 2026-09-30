import { describe, expect, it } from 'vitest'
import type { LockedDoor, Objective, ObjectiveLocation } from '../api/catalog'
import customsJson from '../../public/maps/bigmap/map.json'
import indexJson from '../../public/maps/index.json'
import { buildTabs, doorsForTab, fitView, floorsWithOtherMarkers, layerFor, layerStyle, markerCountsByLevel, project, zoomAt, type MapDef, type MapIndex } from './mapProjection'

const customs = customsJson as MapDef
const index = indexJson as MapIndex
const ground = customs.layers.find((l) => l.level === 0)!

const obj = (id: string, locations?: ObjectiveLocation[]): Objective =>
  ({ conditionId: id, conditionType: 'PlaceBeacon', text: id, targetName: null, targetCount: null, prep: null, locations })
const at = (map: string, ...points: [number, number, number][]): ObjectiveLocation =>
  ({ map, points: points.map(([x, y, z]) => ({ x, y, z })) })

describe('project', () => {
  it('Customs 지상층에서 fuel3 을 미리보기 실측 위치로 보낸다 (회전 180°)', () => {
    const p = project(customs, ground, { x: 334.96, y: 3.04, z: -189.97 })
    expect(p.x).toBeCloseTo(360.5, 1)
    expect(p.y).toBeCloseTo(114.8, 1)
  })

  it('회전 0°: 왼쪽 위 모서리는 (minX, maxZ), 오른쪽 아래는 (maxX, minZ)', () => {
    const layer = { ...ground, viewBox: { width: 100, height: 50 }, imageBounds: { min: { x: 0, z: 0 }, max: { x: 200, z: 100 } } }
    const def = { ...customs, coordinateRotation: 0 }
    expect(project(def, layer, { x: 0, y: 0, z: 100 })).toEqual({ x: 0, y: 0 })
    expect(project(def, layer, { x: 200, y: 0, z: 0 })).toEqual({ x: 100, y: 50 })
  })
})

describe('layerFor', () => {
  it('지상 점은 지상층', () => {
    expect(layerFor(customs, { x: 334.96, y: 3.04, z: -189.97 }).level).toBe(0)
  })

  it('지하 영역 안의 점은 부피가 가장 작은 지하층 (지상층 영역에도 들어 있지만)', () => {
    // "switch basement": x 323~349, 높이 -100~0.5, z -88~-32
    expect(layerFor(customs, { x: 330, y: -2, z: -60 }).level).toBe(-1)
  })

  it('어느 층에도 안 들면 기본 층', () => {
    expect(layerFor(customs, { x: 9999, y: 0, z: 9999 }).level).toBe(customs.defaultLevel)
  })
})

describe('layerStyle (DynamicMaps MapLayer.OnTopLevelSelected 와 같은 규칙)', () => {
  it('선택한 층은 그대로, 아래층은 한 층당 밝기 절반으로 겹친다', () => {
    expect(layerStyle(1, 1, 0)).toEqual({ visible: true, brightness: 1, opacity: 1 })
    expect(layerStyle(0, 1, 0)).toEqual({ visible: true, brightness: 0.5, opacity: 1 })
    expect(layerStyle(-1, 1, 0)).toEqual({ visible: true, brightness: 0.25, opacity: 1 })
  })

  it('위층은 숨기되 기본 층만 흐리게 남긴다', () => {
    expect(layerStyle(1, -1, 0).visible).toBe(false)
    expect(layerStyle(0, -1, 0)).toEqual({ visible: true, brightness: 1, opacity: 0.1 })
  })
})

describe('buildTabs', () => {
  it('맵 정의로 묶고, 목표 순서에서 처음 나온 순으로 탭을 만든다', () => {
    const tabs = buildTabs([
      obj('a', [at('woods', [1, 0, 1])]),
      obj('b', [at('bigmap', [2, 0, 2]), at('woods', [3, 0, 3])]),
    ], index)
    expect(tabs.map((t) => t.key)).toEqual(['woods', 'bigmap'])
    expect(tabs[0].markers.map((m) => m.n)).toEqual([1, 2])
    expect(tabs[1].markers.map((m) => m.n)).toEqual([2])
  })

  it('맵 키는 internalNames 와 대소문자 무시로 대조하고 짝 맵은 한 탭이 된다', () => {
    const tabs = buildTabs([
      obj('a', [at('sandbox', [1, 0, 1])]),
      obj('b', [at('sandbox_high', [2, 0, 2])]),
      obj('c', [at('factory4_night', [3, 0, 3])]),
    ], index)
    expect(tabs.map((t) => t.key)).toEqual(['sandbox', 'factory4_day'])
    expect(tabs[0].markers).toHaveLength(2)
  })

  it('짝 맵에 같은 좌표가 있으면 한 탭에 한 번만 찍는다 (공장 주간·야간의 같은 존)', () => {
    const tabs = buildTabs([
      obj('a', [at('factory4_day', [66.67, -1.68, -28.88]), at('factory4_night', [66.67, -1.68, -28.88])]),
      obj('b', [at('factory4_day', [1, 0, 1]), at('factory4_night', [2, 0, 2])]),
    ], index)
    expect(tabs[0].markers.map((m) => m.n)).toEqual([1, 2, 2])
  })

  it('번호는 위치가 있는 목표끼리 매기고, 점이 여러 개면 같은 번호가 여러 번 나온다', () => {
    const tabs = buildTabs([
      obj('kill'),
      obj('none', []),
      obj('a', [at('bigmap', [1, 0, 1], [2, 0, 2])]),
    ], index)
    expect(tabs[0].markers.map((m) => [m.n, m.conditionId])).toEqual([[1, 'a'], [1, 'a']])
  })

  it('맵 정의가 없는 맵 키는 탭을 만들지 않는다', () => {
    expect(buildTabs([obj('a', [at('terminal', [1, 0, 1])])], index)).toEqual([])
  })
})

describe('doorsForTab', () => {
  const door = (keyTpl: string, x: number, kind: LockedDoor['kind'] = 'door'): LockedDoor =>
    ({ keyTpl, keyName: keyTpl, kind, position: { x, y: 0, z: 0 } })

  it('탭의 맵 정의에 속한 서버 맵 키의 문을 모으고, 짝 맵의 같은 문은 한 번만', () => {
    const doors = {
      factory4_day: [door('a', 1), door('k', 2, 'keycard')],
      factory4_night: [door('a', 1), door('b', 3)],
      bigmap: [door('c', 4)],
    }
    expect(doorsForTab(doors, index, 'factory4_day').map((d) => d.keyTpl)).toEqual(['a', 'k', 'b'])
  })

  it('맵 키는 대소문자를 무시하고, 문 정보가 없으면 빈 배열', () => {
    expect(doorsForTab({ sandbox_high: [door('a', 1)] }, index, 'sandbox')).toHaveLength(1)
    expect(doorsForTab(undefined, index, 'bigmap')).toEqual([])
    expect(doorsForTab({}, index, 'labyrinth')).toEqual([])
  })
})

describe('floorsWithOtherMarkers', () => {
  it('현재 층이 아닌, 마커가 있는 층만', () => {
    const counts = new Map([[0, 3], [-1, 1]])
    expect([...floorsWithOtherMarkers(counts, 0)]).toEqual([-1])
    expect([...floorsWithOtherMarkers(counts, 1)].sort()).toEqual([-1, 0])
  })
})

describe('markerCountsByLevel', () => {
  it('층마다 그 층에 찍힐 마커 수', () => {
    const counts = markerCountsByLevel(customs, [
      { n: 1, conditionId: 'a', point: { x: 334.96, y: 3.04, z: -189.97 } },
      { n: 2, conditionId: 'b', point: { x: 330, y: -2, z: -60 } },
      { n: 3, conditionId: 'c', point: { x: 101.45, y: 3.06, z: -14.1 } },
    ])
    expect(counts.get(0)).toBe(2)
    expect(counts.get(-1)).toBe(1)
    expect(counts.get(1)).toBeUndefined()
  })
})

describe('zoomAt / fitView', () => {
  it('커서 아래의 점이 확대 후에도 같은 화면 위치에 있다', () => {
    const v = zoomAt(fitView(), 2, 100, 50)
    expect(v).toEqual({ scale: 2, x: -100, y: -50 })
    // 내용 좌표 (100, 50) → 화면 100*2-100 = 100, 50*2-50 = 50
  })

  it('배율은 1~12 로 제한된다', () => {
    expect(zoomAt(fitView(), 0.5, 10, 10)).toEqual(fitView())
    expect(zoomAt({ scale: 10, x: 0, y: 0 }, 2, 0, 0).scale).toBe(12)
  })
})

# 퀘스트 존 덤프 원본

`QuestCodex.ZoneDump` 플러그인이 레이드 진입 15초 뒤에 자동으로 남긴 덤프를 그대로 보관한 것이다.
정식 기능에 쓸 스냅샷은 이 원본을 가공해서 따로 만든다.

- 수집일: 2026-09-25
- 클라이언트: EFT `0.16.9.40743` (SPT 4.1.5 서버), 퀘스트를 하나도 수락하지 않은 상태
- 좌표: Unity 월드 좌표 그대로 (`X`, `Y` = 높이, `Z`). 서버 `looseLoot.json`과 같은 좌표계
- `Zones`: `TriggerWithId`(비활성 포함) + `FlareShootDetectorZone`(신호탄 존)
- `Doors`: `KeyId`가 있는 `WorldInteractiveObject` 전부. 문뿐 아니라 잠긴 컨테이너와 트렁크도 들어 있다

| 파일 | 맵 | 존 | 신호탄 | 잠긴 오브젝트 | 비고 |
|---|---|---|---|---|---|
| `bigmap.json` | Customs | 115 | — | 34 | 신호탄 수집을 추가하기 전에 덤프함 |
| `factory4_day.json` | Factory 주간 | 79 | — | 4 | 〃 |
| `factory4_night.json` | Factory 야간 | 85 | — | 4 | 〃, 주간과 존 배치가 일부 다름 |
| `sandbox.json` | Ground Zero 저레벨 | 25 | — | 6 | 〃 |
| `sandbox_high.json` | Ground Zero 고레벨 | 26 | 1 | 6 | 퀘스트 존은 저레벨과 같음 |
| `rezervbase.json` | Reserve | 73 | 2 | 33 | 신호탄 수집을 추가한 뒤 다시 덤프함 |
| `tarkovstreets.json` | Streets | 99 | 3 | 63 | |
| `woods.json` | Woods | 77 | 2 | 4 | `bunker2`(아이스크림 콘) 없음 |
| `shoreline.json` | Shoreline | 104 | 0 | 38 | |
| `interchange.json` | Interchange | 34 | 0 | 101 | 잠긴 오브젝트 대부분이 컨테이너(74개) |
| `lighthouse.json` | Lighthouse | 96 | 2 | 26 | |
| `laboratory.json` | Labs | 13 | 0 | 16 | |

"신호탄 —"인 네 맵에는 바닐라 신호탄 목표가 없어서 다시 덤프하지 않았다.
미측정 맵은 Labyrinth다.

대조: `node tools/zone-dump/check-coverage.js tools/zone-dump/dumps`

## 남은 존 (2026-09-25 기준, 461개 중 450개 확보)

존 목표가 있는 바닐라 퀘스트 201개 중 192개는 모든 존을 찾았다. 아래 9개 퀘스트가 남아 있다.

| 퀘스트 | 퀘스트 맵 | 빠진 존 ID | 추정 / 다음 할 일 |
|---|---|---|---|
| Hypotheses Testing | labyrinth | `event_labyrinth_06_mech_place_01` | Labyrinth 미측정 → 진입해서 덤프 |
| Confidential Info | labyrinth | `event_labyrinth_07_peacekeep_place_01` | 〃 |
| This Tape Sucks | labyrinth | `event_labyrinth_08_therap_place_01` | 〃 |
| Keeper's Word | labyrinth | `event_labyrinth_11_lightkeep_place_01`, `_02`, `_03␠` | 〃. `_03`은 퀘스트 데이터에 **끝 공백**이 붙어 있으니 ID를 trim하고 비교할 것 |
| Offensive Reconnaissance | any | `event_labyrinth_05_mech_place_01` | ID로 보아 Labyrinth일 가능성이 큼 |
| 아이스크림 콘 | woods | `bunker2` (VisitPlace) | Woods 스폰 직후 덤프에는 없음. ZB-014 벙커 근처에서 `F9`로 다시 덤프해 볼 것(하위 씬 지연 로드 의심). 그래도 없으면 다른 컴포넌트이거나 BSG가 삭제한 존 |
| New Day, New Paths | marathon | `Check_cinema` | 같은 퀘스트의 다른 존(`Transits_to_streets`, `Prospect_mira`)은 Ground Zero에 있음. 트랜짓 관련이면 `TransitPoint` 등 다른 컴포넌트 의심 |
| Beneath The Streets | marathon | `Labs_transits` | 나머지 4개 존은 Labs에 있음. 이름상 트랜짓 지점 → 위와 같은 의심 |
| Friend from Norvinsk - Part 5 | any | `1` (2건) | 존 ID가 `"1"` — BSG 데이터의 자리표시자로 추정, 찾을 대상이 아닐 가능성이 큼 |

진단 아이디어: `F9`를 누르면 씬의 모든 `MonoBehaviour`에서 위 ID 문자열을 값으로 가진 필드를 찾아 컴포넌트 종류와 위치를 로그로 남기게 한다.

## SPT 업데이트 시 갱신 방법

존 좌표는 서버 데이터에 없고 클라이언트의 맵 씬 안에만 있어서, 스냅샷(`server/Data/quest-zones.json`)은 게임에 들어가서 뽑아야 한다. 매번 모든 맵을 돌 필요는 없고, **바뀐 맵만** 다시 덤프하면 된다.

모드 퀘스트 존(WTT `CustomQuestZones`)과 퀘스트 아이템 위치(looseLoot)는 서버가 실행 중에 직접 읽으므로 갱신할 필요가 없다.

1. **갱신이 필요한지 확인**: 새 SPT 데이터로 루트에서 `dotnet test`를 돌린다.
   - `VanillaSmokeTests.Vanilla_catalog_has_quest_locations`가 실패하면 못 찾는 존 목록이 위 "남은 존"과 달라졌다는 뜻이다.
   - 서버 로그의 `questZoneNotFound` 경고 수가 늘어난 것으로도 알 수 있다.
2. **어느 맵인지 확인**: `node tools/zone-dump/check-coverage.js tools/zone-dump/dumps`
   - 빠진 존마다 `퀘스트 이름 [퀘스트 맵]`이 나온다. 맵이 `아무 지역`·`Transition`이면 존 ID와 같은 퀘스트의 다른 목표로 맵을 짐작한다.
   - SPT 데이터 경로가 다르면 두 번째 인자로 `…/SPT_Data/database`를 넘긴다.
3. **그 맵만 덤프**
   - 게임 폴더의 `BepInEx/plugins/QuestCodex.ZoneDump/`에 플러그인이 있어야 한다. 없으면 `tools/zone-dump/`를 빌드해서 넣는다.
   - **퀘스트를 수락하지 않은 상태로** 해당 맵에 진입하면 15초 뒤 자동으로 덤프된다. 하위 씬이 늦게 로드되는 곳은 그 근처에서 `F9`를 눌러 다시 덤프한다.
   - 결과는 플러그인 폴더의 `dumps/<맵>.json`에 생긴다.
4. **스냅샷 재생성**
   - 새 덤프 파일로 `tools/zone-dump/dumps/`의 같은 이름 파일을 교체한다.
   - `node tools/zone-dump/build-snapshot.js tools/zone-dump/dumps server/Data/quest-zones.json "EFT <클라이언트 버전>"`을 실행한다(덤프 폴더 전체를 다시 읽는다).
   - `check-coverage.js`를 다시 돌려 빠진 존이 줄었는지 확인한다.
5. **기대값과 문서 갱신**: 위 "남은 존" 표, `VanillaSmokeTests`의 `remaining` 목록, 이 README 상단의 수집일·클라이언트 버전·맵 표를 함께 고친다. 그다음 `dotnet test` → 배포.

주의: 맵이 개편되어 **존 위치만 옮겨지고 ID는 그대로**인 경우는 테스트로 잡히지 않는다. 패치 노트에 맵 개편이 있으면 그 맵은 테스트 결과와 상관없이 다시 덤프한다.

새 맵(예: 아직 정의가 없는 `terminal`)의 **지도 그림**은 이 절차와 별개다. DynamicMaps가 그 맵을 지원한 뒤 `node tools/maps/build-maps.js <DynamicMaps 클론>`을 다시 돌린다. 그 전까지 그 맵의 좌표는 카탈로그에는 들어가지만 팝업 탭은 만들어지지 않는다.

using System.Text.Json;
using QuestCodex.Catalog.Locations;
using QuestCodex.Catalog.Models;
using SPTarkov.DI.Annotations;
using PointTable = System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyList<QuestCodex.Catalog.Models.MapPoint>>>;
using AreaTable = System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyList<QuestCodex.Catalog.Models.MapArea>>>;

namespace QuestCodex.Services;

/// <summary>
/// 모드에 동봉한 바닐라 퀘스트 존 스냅샷(Data/quest-zones.json). 존 트리거는 클라이언트 맵 씬에만 있어서
/// 개발자가 덤프 플러그인(tools/zone-dump)으로 맵마다 한 번 뽑아 둔 것이다. 없으면 Zones == null 이고
/// 카탈로그가 경고를 낸다(기동 실패 아님). VanillaSnapshot 과 같은 처리다.
/// </summary>
[Injectable(InjectionType.Singleton)]
public class QuestZoneSnapshot
{
    private readonly Lazy<Snapshot?> _data = new(LoadFromModFolder);

    public string? CollectedWith => _data.Value?.CollectedWith;
    public PointTable? Zones => _data.Value?.Zones;
    /// <summary>map → 잠긴 문(Door·KeycardDoor). 스냅샷이 없으면 null, doors 절이 없는 구버전 스냅샷이면 빈 사전.</summary>
    public IReadOnlyDictionary<string, IReadOnlyList<SnapshotDoor>>? Doors => _data.Value?.Doors;
    /// <summary>map → zoneId → 영역(덤프 Bounds 의 x·z 크기). 크기가 없는 존은 빠진다.</summary>
    public AreaTable? Areas => _data.Value?.Areas;

    public sealed record Snapshot(string CollectedWith, PointTable Zones, IReadOnlyDictionary<string, IReadOnlyList<SnapshotDoor>> Doors)
    {
        /// <summary>위치 인수가 아니라 init 속성 — 기존 3-분해(var (_, zones, doors) = …) 호출을 깨지 않으려고.</summary>
        public AreaTable Areas { get; init; } = new Dictionary<string, IReadOnlyDictionary<string, IReadOnlyList<MapArea>>>();
    }

    public static Snapshot Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var collectedWith = doc.RootElement.TryGetProperty("collectedWith", out var c) ? c.GetString() ?? "" : "";
        var builder = new PointTableBuilder();
        var areas = new AreaTableBuilder();
        foreach (var map in doc.RootElement.GetProperty("zones").EnumerateObject())
        {
            foreach (var zone in map.Value.EnumerateObject())
            {
                foreach (var p in zone.Value.EnumerateArray())
                {
                    var point = new MapPoint(p.GetProperty("x").GetDouble(), p.GetProperty("y").GetDouble(), p.GetProperty("z").GetDouble());
                    builder.Add(map.Name, zone.Name, point);
                    // 영역: 콜라이더 상자 목록(boxes, 덤프 0.0.2+ — 실제 중심·크기·회전) 또는 예전 형식(점에 바로 붙은 sx/sz 외곽 사각형)
                    if (p.TryGetProperty("boxes", out var boxes))
                    {
                        foreach (var box in boxes.EnumerateArray())
                        {
                            if (AreaOf(box, point) is { } a) areas.Add(map.Name, zone.Name, a);
                        }
                    }
                    else if (AreaOf(p, point) is { } a)
                    {
                        areas.Add(map.Name, zone.Name, a);
                    }
                }
            }
        }

        var doors = new Dictionary<string, IReadOnlyList<SnapshotDoor>>(StringComparer.Ordinal);
        if (doc.RootElement.TryGetProperty("doors", out var doorMaps))
        {
            foreach (var map in doorMaps.EnumerateObject())
            {
                doors[map.Name.ToLowerInvariant()] = map.Value.EnumerateArray()
                    .Select(d => new SnapshotDoor(
                        d.GetProperty("key").GetString() ?? throw new InvalidOperationException("door key is null"),
                        d.GetProperty("type").GetString() ?? throw new InvalidOperationException("door type is null"),
                        new MapPoint(d.GetProperty("x").GetDouble(), d.GetProperty("y").GetDouble(), d.GetProperty("z").GetDouble())))
                    .ToList();
            }
        }

        return new Snapshot(collectedWith, builder.Build(), doors) { Areas = areas.Build() };
    }

    /// <summary>
    /// sx·sz 가 있으면 영역 하나. 중심은 cx·cz(없으면 존 위치), 높이 Center.Y 는 존 위치의 y, 회전 r(없으면 0),
    /// 높이 범위 y0·y1(없으면 위치 높이 한 점).
    /// </summary>
    private static MapArea? AreaOf(JsonElement e, MapPoint point)
    {
        if (!e.TryGetProperty("sx", out var sx) || !e.TryGetProperty("sz", out var sz)) return null;
        double Or(string name, double fallback) => e.TryGetProperty(name, out var v) ? v.GetDouble() : fallback;
        return new MapArea(
            new MapPoint(Or("cx", point.X), point.Y, Or("cz", point.Z)),
            sx.GetDouble(), sz.GetDouble(), Or("r", 0), Or("y0", point.Y), Or("y1", point.Y));
    }

    public static Snapshot? LoadFromModFolder()
    {
        var modDir = Path.GetDirectoryName(typeof(QuestZoneSnapshot).Assembly.Location);
        if (modDir is null) return null;
        var path = Path.Combine(modDir, "Data", "quest-zones.json");
        return File.Exists(path) ? Parse(File.ReadAllText(path)) : null;
    }
}

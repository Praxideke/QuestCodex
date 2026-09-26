using System.Text.Json;
using QuestCodex.Catalog.Locations;
using QuestCodex.Catalog.Models;
using SPTarkov.DI.Annotations;
using PointTable = System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyList<QuestCodex.Catalog.Models.MapPoint>>>;

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

    public sealed record Snapshot(string CollectedWith, PointTable Zones, IReadOnlyDictionary<string, IReadOnlyList<SnapshotDoor>> Doors);

    public static Snapshot Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var collectedWith = doc.RootElement.TryGetProperty("collectedWith", out var c) ? c.GetString() ?? "" : "";
        var builder = new PointTableBuilder();
        foreach (var map in doc.RootElement.GetProperty("zones").EnumerateObject())
        {
            foreach (var zone in map.Value.EnumerateObject())
            {
                foreach (var p in zone.Value.EnumerateArray())
                {
                    builder.Add(map.Name, zone.Name, new MapPoint(
                        p.GetProperty("x").GetDouble(), p.GetProperty("y").GetDouble(), p.GetProperty("z").GetDouble()));
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

        return new Snapshot(collectedWith, builder.Build(), doors);
    }

    public static Snapshot? LoadFromModFolder()
    {
        var modDir = Path.GetDirectoryName(typeof(QuestZoneSnapshot).Assembly.Location);
        if (modDir is null) return null;
        var path = Path.Combine(modDir, "Data", "quest-zones.json");
        return File.Exists(path) ? Parse(File.ReadAllText(path)) : null;
    }
}

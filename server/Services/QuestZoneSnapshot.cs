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
    private readonly Lazy<(string CollectedWith, PointTable Zones)?> _data = new(LoadFromModFolder);

    public string? CollectedWith => _data.Value?.CollectedWith;
    public PointTable? Zones => _data.Value?.Zones;

    public static (string CollectedWith, PointTable Zones) Parse(string json)
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

        return (collectedWith, builder.Build());
    }

    public static (string CollectedWith, PointTable Zones)? LoadFromModFolder()
    {
        var modDir = Path.GetDirectoryName(typeof(QuestZoneSnapshot).Assembly.Location);
        if (modDir is null) return null;
        var path = Path.Combine(modDir, "Data", "quest-zones.json");
        return File.Exists(path) ? Parse(File.ReadAllText(path)) : null;
    }
}

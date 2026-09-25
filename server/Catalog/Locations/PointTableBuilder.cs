using QuestCodex.Catalog.Models;
using PointTable = System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyList<QuestCodex.Catalog.Models.MapPoint>>>;

namespace QuestCodex.Catalog.Locations;

/// <summary>
/// map → id → 점 표를 모은다. 출처(스냅샷, 모드 존 파일, looseLoot)마다 표기가 달라서 여기서 한 번에 맞춘다:
/// 맵 키는 소문자, ID 는 앞뒤 공백 제거, 같은 맵·ID 의 같은 점은 한 번만.
/// </summary>
public sealed class PointTableBuilder
{
    private readonly Dictionary<string, Dictionary<string, List<MapPoint>>> _maps = new(StringComparer.Ordinal);

    public PointTableBuilder Add(string map, string id, MapPoint point)
    {
        map = map.Trim().ToLowerInvariant();
        id = id.Trim();
        if (map.Length == 0 || id.Length == 0) return this;

        if (!_maps.TryGetValue(map, out var ids)) _maps[map] = ids = new(StringComparer.Ordinal);
        if (!ids.TryGetValue(id, out var points)) ids[id] = points = [];
        if (!points.Contains(point)) points.Add(point);
        return this;
    }

    public PointTableBuilder AddAll(PointTable? table)
    {
        foreach (var (map, ids) in table ?? new Dictionary<string, IReadOnlyDictionary<string, IReadOnlyList<MapPoint>>>())
        {
            foreach (var (id, points) in ids)
            {
                foreach (var p in points) Add(map, id, p);
            }
        }

        return this;
    }

    public PointTable Build()
        => _maps.ToDictionary(
            kv => kv.Key,
            kv => (IReadOnlyDictionary<string, IReadOnlyList<MapPoint>>)kv.Value.ToDictionary(
                x => x.Key, x => (IReadOnlyList<MapPoint>)x.Value.ToList(), StringComparer.Ordinal),
            StringComparer.Ordinal);
}

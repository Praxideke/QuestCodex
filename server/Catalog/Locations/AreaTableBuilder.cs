using QuestCodex.Catalog.Models;
using AreaTable = System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyList<QuestCodex.Catalog.Models.MapArea>>>;

namespace QuestCodex.Catalog.Locations;

/// <summary>
/// map → zoneId → 영역 표. <see cref="PointTableBuilder"/> 와 같은 정규화(맵 키 소문자, ID trim, 같은 값 한 번만)를
/// 한다. 점 표와 따로 두는 이유: MapPoint 를 바꾸면 카탈로그의 모든 좌표 형식이 바뀌고, 영역은 일부 조건에서만 쓴다.
/// </summary>
public sealed class AreaTableBuilder
{
    private readonly Dictionary<string, Dictionary<string, List<MapArea>>> _maps = new(StringComparer.Ordinal);

    public AreaTableBuilder Add(string map, string id, MapArea area)
    {
        map = map.Trim().ToLowerInvariant();
        id = id.Trim();
        if (map.Length == 0 || id.Length == 0) return this;

        if (!_maps.TryGetValue(map, out var ids)) _maps[map] = ids = new(StringComparer.Ordinal);
        if (!ids.TryGetValue(id, out var areas)) ids[id] = areas = [];
        if (!areas.Contains(area)) areas.Add(area);
        return this;
    }

    public AreaTableBuilder AddAll(AreaTable? table)
    {
        foreach (var (map, ids) in table ?? new Dictionary<string, IReadOnlyDictionary<string, IReadOnlyList<MapArea>>>())
        {
            foreach (var (id, areas) in ids)
            {
                foreach (var a in areas) Add(map, id, a);
            }
        }

        return this;
    }

    public AreaTable Build()
        => _maps.ToDictionary(
            kv => kv.Key,
            kv => (IReadOnlyDictionary<string, IReadOnlyList<MapArea>>)kv.Value.ToDictionary(
                x => x.Key, x => (IReadOnlyList<MapArea>)x.Value.ToList(), StringComparer.Ordinal),
            StringComparer.Ordinal);
}

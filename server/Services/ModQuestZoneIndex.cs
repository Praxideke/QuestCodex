using System.Globalization;
using System.Text.Json;
using QuestCodex.Catalog.Locations;
using QuestCodex.Catalog.Models;
using SPTarkov.DI.Annotations;
using PointTable = System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyList<QuestCodex.Catalog.Models.MapPoint>>>;
using AreaTable = System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyList<QuestCodex.Catalog.Models.MapArea>>>;

namespace QuestCodex.Services;

/// <summary>
/// 모드가 추가한 퀘스트 존 좌표. WTT-ServerCommonLib 형식(user/mods/*/db/CustomQuestZones/*.json)만 읽는다:
/// <c>[{ ZoneId, ZoneLocation, Position: { X, Y, Z } }]</c>, 좌표는 보통 문자열이고 ZoneLocation 은 대소문자가 제각각이다.
/// 모드 존은 클라이언트 덤프에 잡히지 않아서(스펙 §0) 스냅샷과 따로 실행 시 스캔한다. 서버 수명당 1회.
/// Scale·Rotation 이 있으면 영역도 만든다(08 스펙): WTT-ClientCommonLib 가 BoxCollider(1×1×1)에 localScale = Scale,
/// rotation = Rotation 을 주므로 Scale 이 월드 전체 폭이고, 지도에는 수직축 회전각(yaw)만 쓴다.
/// 깨진 파일·항목은 조용히 건너뛴다 — 위치 표시는 부가 정보라 경고로 로그를 어지럽히지 않는다.
/// </summary>
[Injectable(InjectionType.Singleton)]
public class ModQuestZoneIndex
{
    private readonly Lazy<(PointTable Zones, AreaTable Areas)> _data = new(Scan);

    public PointTable Zones => _data.Value.Zones;
    public AreaTable Areas => _data.Value.Areas;

    private static (PointTable, AreaTable) Scan()
    {
        var modDir = Path.GetDirectoryName(typeof(ModQuestZoneIndex).Assembly.Location);
        var modsRoot = modDir is null ? null : Directory.GetParent(modDir)?.FullName;
        return modsRoot is null ? (new PointTableBuilder().Build(), new AreaTableBuilder().Build()) : ScanRoot(modsRoot);
    }

    /// <summary>순수 로직만 분리 — 테스트가 임시 디렉터리로 호출한다.</summary>
    public static (PointTable Zones, AreaTable Areas) ScanRoot(string modsRoot)
    {
        var points = new PointTableBuilder();
        var areas = new AreaTableBuilder();
        if (!Directory.Exists(modsRoot)) return (points.Build(), areas.Build());

        foreach (var modDir in Directory.GetDirectories(modsRoot).Order(StringComparer.OrdinalIgnoreCase))
        {
            var zonesDir = Path.Combine(modDir, "db", "CustomQuestZones");
            if (!Directory.Exists(zonesDir)) continue;

            foreach (var file in Directory.GetFiles(zonesDir, "*.json").Order(StringComparer.OrdinalIgnoreCase))
            {
                try
                {
                    using var doc = JsonDocument.Parse(File.ReadAllText(file));
                    if (doc.RootElement.ValueKind != JsonValueKind.Array) continue;
                    foreach (var zone in doc.RootElement.EnumerateArray()) AddZone(points, areas, zone);
                }
                catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
                {
                    // 깨진 파일은 건너뛴다.
                }
            }
        }

        return (points.Build(), areas.Build());
    }

    private static void AddZone(PointTableBuilder points, AreaTableBuilder areas, JsonElement zone)
    {
        if (zone.ValueKind != JsonValueKind.Object) return;
        var id = String(zone, "ZoneId");
        var map = String(zone, "ZoneLocation");
        if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(map)) return;
        if (!zone.TryGetProperty("Position", out var pos) || pos.ValueKind != JsonValueKind.Object) return;
        if (Number(pos, "X") is not { } x || Number(pos, "Y") is not { } y || Number(pos, "Z") is not { } z) return;

        var center = new MapPoint(x, y, z);
        points.Add(map, id, center);

        if (zone.TryGetProperty("Scale", out var scale) && scale.ValueKind == JsonValueKind.Object
            && Number(scale, "X") is { } sx && Number(scale, "Z") is { } sz && sx > 0 && sz > 0)
        {
            // 높이 범위: BoxCollider 는 중심 기준이라 위치 ± Scale.Y/2(x·z축 기울기는 무시)
            var halfY = (Number(scale, "Y") ?? 0) / 2;
            areas.Add(map, id, new MapArea(center, sx, sz, YawOf(zone), y - halfY, y + halfY));
        }
    }

    /// <summary>사원수 → 수직축 회전각(도). Unity 규약: atan2(2(w·y + x·z), 1 − 2(x² + y²)). 없거나 깨졌으면 0.</summary>
    private static double YawOf(JsonElement zone)
    {
        if (!zone.TryGetProperty("Rotation", out var r) || r.ValueKind != JsonValueKind.Object) return 0;
        var qx = Number(r, "X") ?? 0;
        var qy = Number(r, "Y") ?? 0;
        var qz = Number(r, "Z") ?? 0;
        var qw = Number(r, "W") ?? 1;
        var yaw = Math.Atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qx * qx + qy * qy)) * 180 / Math.PI;
        return Math.Round(yaw, 2);
    }

    private static string? String(JsonElement obj, string name)
        => obj.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static double? Number(JsonElement obj, string name)
    {
        if (!obj.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number) return v.GetDouble();
        if (v.ValueKind == JsonValueKind.String
            && double.TryParse(v.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var d)
            && double.IsFinite(d)) return d;
        return null;
    }
}

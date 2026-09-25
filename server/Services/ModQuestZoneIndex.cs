using System.Globalization;
using System.Text.Json;
using QuestCodex.Catalog.Locations;
using QuestCodex.Catalog.Models;
using SPTarkov.DI.Annotations;
using PointTable = System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyList<QuestCodex.Catalog.Models.MapPoint>>>;

namespace QuestCodex.Services;

/// <summary>
/// 모드가 추가한 퀘스트 존 좌표. WTT-ServerCommonLib 형식(user/mods/*/db/CustomQuestZones/*.json)만 읽는다:
/// <c>[{ ZoneId, ZoneLocation, Position: { X, Y, Z } }]</c>, 좌표는 보통 문자열이고 ZoneLocation 은 대소문자가 제각각이다.
/// 모드 존은 클라이언트 덤프에 잡히지 않아서(스펙 §0) 스냅샷과 따로 실행 시 스캔한다. 서버 수명당 1회.
/// 깨진 파일·항목은 조용히 건너뛴다 — 위치 표시는 부가 정보라 경고로 로그를 어지럽히지 않는다.
/// </summary>
[Injectable(InjectionType.Singleton)]
public class ModQuestZoneIndex
{
    private readonly Lazy<PointTable> _data = new(Scan);

    public PointTable Zones => _data.Value;

    private static PointTable Scan()
    {
        var modDir = Path.GetDirectoryName(typeof(ModQuestZoneIndex).Assembly.Location);
        var modsRoot = modDir is null ? null : Directory.GetParent(modDir)?.FullName;
        return modsRoot is null ? new PointTableBuilder().Build() : ScanRoot(modsRoot);
    }

    /// <summary>순수 로직만 분리 — 테스트가 임시 디렉터리로 호출한다.</summary>
    public static PointTable ScanRoot(string modsRoot)
    {
        var builder = new PointTableBuilder();
        if (!Directory.Exists(modsRoot)) return builder.Build();

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
                    foreach (var zone in doc.RootElement.EnumerateArray()) AddZone(builder, zone);
                }
                catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
                {
                    // 깨진 파일은 건너뛴다.
                }
            }
        }

        return builder.Build();
    }

    private static void AddZone(PointTableBuilder builder, JsonElement zone)
    {
        if (zone.ValueKind != JsonValueKind.Object) return;
        var id = String(zone, "ZoneId");
        var map = String(zone, "ZoneLocation");
        if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(map)) return;
        if (!zone.TryGetProperty("Position", out var pos) || pos.ValueKind != JsonValueKind.Object) return;
        if (Number(pos, "X") is not { } x || Number(pos, "Y") is not { } y || Number(pos, "Z") is not { } z) return;

        builder.Add(map, id, new MapPoint(x, y, z));
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

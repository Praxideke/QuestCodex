using QuestCodex.Catalog.Models;
using QuestCodex.Services;

namespace QuestCodex.Tests.Services;

public class ModQuestZoneIndexTests
{
    private sealed class TempModsRoot : IDisposable
    {
        public string Root { get; } = Directory.CreateTempSubdirectory("qc-zones-").FullName;

        public void AddZones(string modName, string fileName, string json)
        {
            var dir = Path.Combine(Root, modName, "db", "CustomQuestZones");
            Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, fileName), json);
        }

        public void Dispose() => Directory.Delete(Root, recursive: true);
    }

    /// <summary>WTT-ServerCommonLib 형식. 좌표는 문자열이다.</summary>
    private static string Zone(string id, string location, string x, string y, string z) => $$"""
        { "ZoneId": "{{id}}", "ZoneName": "{{id}}", "ZoneLocation": "{{location}}", "ZoneType": "visit", "FlareType": "",
          "Position": { "X": "{{x}}", "Y": "{{y}}", "Z": "{{z}}", "W": "0" },
          "Rotation": { "X": "0", "Y": "0", "Z": "0" }, "Scale": { "X": "1", "Y": "1", "Z": "1" } }
        """;

    /// <summary>
    /// 영역: WTT 는 BoxCollider(1×1×1)에 localScale = Scale, rotation = Rotation 을 준다(WTT-ClientCommonLib 디컴파일) —
    /// Scale 이 월드 전체 폭이고, 지도에는 수직축 회전각(yaw)만 쓴다. 값은 sptQuestLive "해충 구제" 파일 그대로.
    /// </summary>
    [Fact]
    public void Scale_and_rotation_become_an_area_with_yaw()
    {
        using var mods = new TempModsRoot();
        mods.AddZones("sptQuestLive", "PestControl.json", """
            [{ "ZoneId": "jaegar_pest_control", "ZoneLocation": "RezervBase", "ZoneType": "botkillzone",
               "Position": { "X": "-120.8822", "Y": "0.3169889", "Z": "50.33869", "W": "0" },
               "Rotation": { "X": "0", "Y": "0.1240344", "Z": "0", "W": "0.9922779" },
               "Scale": { "X": "101.5", "Y": "16", "Z": "107.25", "W": "0" } }]
            """);

        var (_, areas) = ModQuestZoneIndex.ScanRoot(mods.Root);

        var area = Assert.Single(areas["rezervbase"]["jaegar_pest_control"]);
        Assert.Equal(new MapPoint(-120.8822, 0.3169889, 50.33869), area.Center);
        Assert.Equal(101.5, area.SizeX);
        Assert.Equal(107.25, area.SizeZ);
        Assert.Equal(14.25, area.Yaw, 2);
        Assert.Equal(0.3169889 - 8, area.MinY, 4); // 위치 ± Scale.Y/2
        Assert.Equal(0.3169889 + 8, area.MaxY, 4);
    }

    [Fact]
    public void Zone_without_scale_has_no_area()
    {
        using var mods = new TempModsRoot();
        mods.AddZones("Other", "z.json", """[{ "ZoneId": "p", "ZoneLocation": "bigmap", "Position": { "X": 1, "Y": 2, "Z": 3 } }]""");

        var (zones, areas) = ModQuestZoneIndex.ScanRoot(mods.Root);

        Assert.Single(zones["bigmap"]["p"]);
        Assert.Empty(areas);
    }

    [Fact]
    public void Parses_string_coordinates_and_lowercases_map_names()
    {
        using var mods = new TempModsRoot();
        mods.AddZones("Lotus", "Lotus_zones.json",
            $"[{Zone("lotus_woods_a", "Woods", "-170.7563", "5.761335", "-283.3011")}, {Zone("lotus_woods_b", "woods", "1", "2", "3")}]");

        var (zones, _) = ModQuestZoneIndex.ScanRoot(mods.Root);

        Assert.Equal([new MapPoint(-170.7563, 5.761335, -283.3011)], zones["woods"]["lotus_woods_a"]);
        Assert.Equal([new MapPoint(1, 2, 3)], zones["woods"]["lotus_woods_b"]);
        Assert.False(zones.ContainsKey("Woods"));
    }

    [Fact]
    public void Numeric_coordinates_are_accepted_too()
    {
        using var mods = new TempModsRoot();
        mods.AddZones("Other", "z.json",
            """[{ "ZoneId": " padded ", "ZoneLocation": "bigmap", "Position": { "X": 1.5, "Y": 2, "Z": -3 } }]""");

        var (zones, _) = ModQuestZoneIndex.ScanRoot(mods.Root);

        Assert.Equal([new MapPoint(1.5, 2, -3)], zones["bigmap"]["padded"]);
    }

    [Fact]
    public void Same_zone_in_two_mods_keeps_both_points()
    {
        using var mods = new TempModsRoot();
        mods.AddZones("A", "a.json", $"[{Zone("shared", "bigmap", "1", "0", "0")}]");
        mods.AddZones("B", "b.json", $"[{Zone("shared", "bigmap", "2", "0", "0")}]");

        var (zones, _) = ModQuestZoneIndex.ScanRoot(mods.Root);

        Assert.Equal(2, zones["bigmap"]["shared"].Count);
    }

    [Fact]
    public void Broken_files_and_entries_are_skipped()
    {
        using var mods = new TempModsRoot();
        mods.AddZones("Broken", "bad.json", "{ not json");
        mods.AddZones("Broken", "object.json", """{ "ZoneId": "x" }""");
        mods.AddZones("Good", "good.json",
            $$"""[{{Zone("ok", "bigmap", "1", "2", "3")}}, { "ZoneId": "no_position", "ZoneLocation": "bigmap" }, {{Zone("nan", "bigmap", "abc", "2", "3")}}, {{Zone("", "bigmap", "1", "2", "3")}}]""");

        var (zones, _) = ModQuestZoneIndex.ScanRoot(mods.Root);

        Assert.Equal(["ok"], zones["bigmap"].Keys);
    }

    [Fact]
    public void Only_custom_quest_zones_folder_is_scanned()
    {
        using var mods = new TempModsRoot();
        var elsewhere = Path.Combine(mods.Root, "Mod", "db", "other");
        Directory.CreateDirectory(elsewhere);
        File.WriteAllText(Path.Combine(elsewhere, "zones.json"), $"[{Zone("stray", "bigmap", "1", "2", "3")}]");

        Assert.Empty(ModQuestZoneIndex.ScanRoot(mods.Root).Zones);
    }

    [Fact]
    public void Missing_root_yields_empty_table()
        => Assert.Empty(ModQuestZoneIndex.ScanRoot(Path.Combine(Path.GetTempPath(), "qc-does-not-exist-" + Guid.NewGuid())).Zones);
}

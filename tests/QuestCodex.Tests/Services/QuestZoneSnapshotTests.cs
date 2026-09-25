using QuestCodex.Catalog.Models;
using QuestCodex.Services;

namespace QuestCodex.Tests.Services;

public class QuestZoneSnapshotTests
{
    [Fact]
    public void Parse_reads_points_per_map_and_zone()
    {
        const string json = """
            { "collectedWith": "EFT 0.16.9.40743",
              "zones": {
                "bigmap": { "fuel4": [{ "x": -334.93, "y": 2.22, "z": -163.46 }], "two": [{ "x": 1, "y": 2, "z": 3 }, { "x": 4, "y": 5, "z": 6 }] },
                "rezervbase": { "fuel4": [{ "x": -334.93, "y": -101.46, "z": -163.46 }] } } }
            """;

        var (collectedWith, zones) = QuestZoneSnapshot.Parse(json);

        Assert.Equal("EFT 0.16.9.40743", collectedWith);
        Assert.Equal([new MapPoint(-334.93, 2.22, -163.46)], zones["bigmap"]["fuel4"]);
        Assert.Equal(2, zones["bigmap"]["two"].Count);
        Assert.Equal(-101.46, zones["rezervbase"]["fuel4"][0].Y);
    }

    [Fact]
    public void Parse_rejects_missing_zones()
        => Assert.ThrowsAny<Exception>(() => QuestZoneSnapshot.Parse("""{ "collectedWith": "x" }"""));

    [Fact]
    public void Bundled_snapshot_file_exists_next_to_assembly_and_parses()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Data", "quest-zones.json");
        Assert.True(File.Exists(path), $"missing {path}");

        var (_, zones) = QuestZoneSnapshot.Parse(File.ReadAllText(path));

        Assert.True(zones.Count >= 12, $"only {zones.Count} maps");
        Assert.All(zones.Keys, map => Assert.Equal(map.ToLowerInvariant(), map));
        foreach (var fuel in new[] { "fuel1", "fuel2", "fuel3", "fuel4" }) Assert.True(zones["bigmap"].ContainsKey(fuel), fuel);
    }
}

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using BepInEx;
using BepInEx.Configuration;
using Comfort.Common;
using EFT;
using EFT.Interactive;
using Newtonsoft.Json;
using UnityEngine;

namespace QuestCodex.ZoneDump;

// Dev tool (not shipped): captures quest zone coordinates once per map
// without accepting any quest. Positions are raw Unity world coordinates (x, y = height, z),
// the same space as the server's looseLoot.json, so no conversion happens here.
[BepInPlugin("com.viper.questcodex.zonedump", "QuestCodex Zone Dump (spike)", "0.0.1")]
public class ZoneDumpPlugin : BaseUnityPlugin
{
    private const float AutoDumpDelaySeconds = 15f;

    private ConfigEntry<KeyboardShortcut> _dumpKey = null!;
    private string? _dumpedLocation;
    private float _raidSeenAt = -1f;

    private string DumpDir => Path.Combine(Path.GetDirectoryName(Info.Location)!, "dumps");

    private void Awake()
    {
        _dumpKey = Config.Bind("Dump", "Manual dump key", new KeyboardShortcut(KeyCode.F9),
            "Dump the current raid scene again");
        Logger.LogInfo($"Zone dump spike loaded, output: {DumpDir}");
    }

    private void Update()
    {
        var location = Singleton<GameWorld>.Instance?.MainPlayer?.Location;
        if (string.IsNullOrEmpty(location))
        {
            _raidSeenAt = -1f;
            _dumpedLocation = null;
            return;
        }

        if (_dumpKey.Value.IsDown())
        {
            Dump(location!);
            return;
        }

        // Auto dump once per raid, after the scene has had time to settle.
        if (_dumpedLocation == location) return;
        if (_raidSeenAt < 0f) _raidSeenAt = Time.time;
        if (Time.time - _raidSeenAt < AutoDumpDelaySeconds) return;

        Dump(location!);
    }

    private void Dump(string location)
    {
        _dumpedLocation = location;
        try
        {
            // includeInactive: zones that only switch on under some quest state still exist in the scene.
            var zones = FindObjectsOfType<TriggerWithId>(true)
                .Select(t => new ZoneRow
                {
                    Id = t.Id,
                    Type = t.GetType().Name,
                    Active = t.gameObject.activeInHierarchy,
                    Position = V(t.transform.position),
                    Bounds = BoundsOf(t.gameObject),
                })
                // LaunchFlare conditions are judged by a separate component, not a TriggerWithId.
                .Concat(FindObjectsOfType<FlareShootDetectorZone>(true)
                    .Select(f => new ZoneRow
                    {
                        Id = f.zoneID,
                        Type = nameof(FlareShootDetectorZone),
                        Active = f.gameObject.activeInHierarchy,
                        Position = V(f.transform.position),
                        Bounds = BoundsOf(f.gameObject),
                    }))
                .OrderBy(z => z.Id)
                .ToList();

            var doors = FindObjectsOfType<WorldInteractiveObject>(true)
                .Where(d => !string.IsNullOrEmpty(d.KeyId))
                .Select(d => new DoorRow
                {
                    Id = d.Id,
                    KeyId = d.KeyId,
                    Type = d.GetType().Name,
                    Operatable = d.Operatable,
                    Position = V(d.transform.position),
                })
                .OrderBy(d => d.KeyId)
                .ToList();

            var dump = new DumpFile
            {
                Location = location,
                DumpedAtUtc = DateTime.UtcNow.ToString("o"),
                Zones = zones,
                Doors = doors,
            };

            Directory.CreateDirectory(DumpDir);
            // The game reports some ids capitalized (Sandbox, RezervBase); the server's locations folder is lowercase.
            var path = Path.Combine(DumpDir, $"{location.ToLowerInvariant()}.json");
            File.WriteAllText(path, JsonConvert.SerializeObject(dump, Formatting.Indented));
            Logger.LogInfo($"Dumped {location}: {zones.Count} zones, {doors.Count} locked doors -> {path}");
        }
        catch (Exception e)
        {
            Logger.LogError($"Dump failed for {location}: {e}");
        }
    }

    private static Vec V(Vector3 v) => new() { X = v.x, Y = v.y, Z = v.z };

    private static BoundsRow? BoundsOf(GameObject go)
    {
        var collider = go.GetComponent<Collider>();
        if (collider == null) return null;
        var b = collider.bounds;
        return new BoundsRow { Min = V(b.min), Max = V(b.max) };
    }

    private class DumpFile
    {
        public string Location = "";
        public string DumpedAtUtc = "";
        public List<ZoneRow> Zones = new();
        public List<DoorRow> Doors = new();
    }

    private class ZoneRow
    {
        public string Id = "";
        public string Type = "";
        public bool Active;
        public Vec Position = new();
        public BoundsRow? Bounds;
    }

    private class DoorRow
    {
        public string Id = "";
        public string KeyId = "";
        public string Type = "";
        public bool Operatable;
        public Vec Position = new();
    }

    private class BoundsRow
    {
        public Vec Min = new();
        public Vec Max = new();
    }

    private class Vec
    {
        public float X, Y, Z;
    }
}

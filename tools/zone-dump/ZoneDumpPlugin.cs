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

// Dev tool (not shipped): captures quest zone coordinates once per map without accepting any quest.
// Press the dump key (F10 by default) inside a raid; nothing is dumped automatically.
// Positions are raw Unity world coordinates (x, y = height, z), the same space as the server's looseLoot.json,
// so no conversion happens here.
[BepInPlugin("com.viper.questcodex.zonedump", "QuestCodex Zone Dump", "0.0.3")]
public class ZoneDumpPlugin : BaseUnityPlugin
{
    private ConfigEntry<KeyboardShortcut> _dumpKey = null!;

    private string DumpDir => Path.Combine(Path.GetDirectoryName(Info.Location)!, "dumps");

    private void Awake()
    {
        // F10: unused by every other plugin config on the dev machine (F9 is FieldKit's "Toggle Chams").
        _dumpKey = Config.Bind("Dump", "Manual dump key", new KeyboardShortcut(KeyCode.F10),
            "Dump the current raid scene (modifier keys are ignored)");
        Logger.LogInfo($"Zone dump loaded (press {_dumpKey.Value} in a raid), output: {DumpDir}");
    }

    private void Update()
    {
        // Read the main key directly: KeyboardShortcut.IsDown() fails while any other modifier (Shift to sprint, Ctrl…)
        // is held, which is easy to do mid-raid and gives no feedback at all.
        if (!Input.GetKeyDown(_dumpKey.Value.MainKey)) return;
        Logger.LogInfo($"Dump key {_dumpKey.Value.MainKey} pressed");

        var location = Singleton<GameWorld>.Instance?.MainPlayer?.Location;
        if (string.IsNullOrEmpty(location))
        {
            Logger.LogWarning("Not in a raid, nothing to dump");
            return;
        }

        Dump(location!);
    }

    private void Dump(string location)
    {
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
                    Colliders = CollidersOf(t.gameObject),
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
                        Colliders = CollidersOf(f.gameObject),
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

    private static Quat Q(Quaternion q) => new() { X = q.x, Y = q.y, Z = q.z, W = q.w };

    /// <summary>
    /// Every collider on the zone object, in world space. Bounds above is only their axis-aligned envelope, which over-states
    /// rotated boxes (e.g. a Streets kill zone drawn over the road). For a BoxCollider this records the real box:
    /// centre (local centre transformed to world), size (local size times lossyScale) and the object's rotation.
    /// Other collider types keep only their type and world bounds.
    /// </summary>
    private static List<ColliderRow> CollidersOf(GameObject go)
        => go.GetComponents<Collider>().Select(c =>
        {
            var row = new ColliderRow { Type = c.GetType().Name, Min = V(c.bounds.min), Max = V(c.bounds.max) };
            if (c is BoxCollider box)
            {
                var t = box.transform;
                row.Center = V(t.TransformPoint(box.center));
                row.Size = V(Vector3.Scale(box.size, t.lossyScale));
                row.Rotation = Q(t.rotation);
                row.Yaw = t.rotation.eulerAngles.y;
            }
            return row;
        }).ToList();

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
        public List<ColliderRow> Colliders = new();
    }

    private class ColliderRow
    {
        public string Type = "";
        public Vec Min = new();
        public Vec Max = new();
        // BoxCollider only (null otherwise)
        public Vec? Center;
        public Vec? Size;
        public Quat? Rotation;
        public float? Yaw;
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

    private class Quat
    {
        public float X, Y, Z, W;
    }
}

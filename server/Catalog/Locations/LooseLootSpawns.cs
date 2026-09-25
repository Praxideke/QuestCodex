using QuestCodex.Catalog.Models;
using SPTarkov.Server.Core.Models.Eft.Common;
using PointTable = System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyDictionary<string, System.Collections.Generic.IReadOnlyList<QuestCodex.Catalog.Models.MapPoint>>>;

namespace QuestCodex.Catalog.Locations;

/// <summary>
/// looseLoot 의 spawnpointsForced(매 레이드 반드시 생기는 스폰) → map → 아이템 tpl → 위치.
/// 바닐라 FindItem 퀘스트 아이템 121건이 모두 여기에 있다. 퀘스트 아이템이 아닌 강제 스폰(크리스마스 연료 등)도
/// 섞여 있지만 거르는 것은 LocationResolver 가 한다(아이템 템플릿의 QuestItem 플래그).
/// </summary>
public static class LooseLootSpawns
{
    public static PointTable Forced(IEnumerable<(string Map, LooseLoot? Loot)> maps)
    {
        var builder = new PointTableBuilder();
        foreach (var (map, loot) in maps)
        {
            foreach (var spawn in loot?.SpawnpointsForced ?? [])
            {
                if (spawn.Template?.Position is not { } pos) continue;
                var point = new MapPoint(Round(pos.X), Round(pos.Y), Round(pos.Z));
                foreach (var item in spawn.Template.Items ?? []) builder.Add(map, item.Template.ToString(), point);
            }
        }

        return builder.Build();
    }

    /// <summary>float → double 변환 잡음(334.959991…)을 없앤다. 1cm 면 지도 표시에 충분하다.</summary>
    private static double Round(float v) => Math.Round((double)v, 2);
}

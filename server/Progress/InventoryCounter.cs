using QuestCodex.Progress.Models;
using SPTarkov.Server.Core.Models.Eft.Common.Tables;

namespace QuestCodex.Progress;

/// <summary>
/// 인벤토리 → 퀘스트 아이템 보유 수. 순수 함수.
/// 게임 제출 창과 같은 범위를 센다: 창고·입은 장비 아래 전체(컨테이너 속 포함). 은신처 진열대 등 다른 루트는 제외.
/// </summary>
public static class InventoryCounter
{
    /// <summary>부모 사슬이 이보다 깊으면 순환으로 보고 버린다. 실측 최대 깊이는 한 자릿수.</summary>
    private const int MaxDepth = 64;

    /// <param name="tpls">셀 템플릿 ID. 이 밖의 아이템은 무시한다.</param>
    /// <returns>보유 수가 1 이상인 템플릿만.</returns>
    public static SortedDictionary<string, ItemHolding> Count(BotBaseInventory? inventory, IReadOnlySet<string> tpls)
    {
        var result = new SortedDictionary<string, ItemHolding>(StringComparer.Ordinal);
        if (inventory?.Items is not { } items) return result;

        var roots = new HashSet<string>(StringComparer.Ordinal);
        if (inventory.Stash is { } stash) roots.Add(stash.ToString());
        if (inventory.Equipment is { } equipment) roots.Add(equipment.ToString());

        var parentOf = new Dictionary<string, string?>(StringComparer.Ordinal);
        foreach (var item in items) parentOf[item.Id.ToString()] = item.ParentId;

        foreach (var item in items)
        {
            var tpl = item.Template.ToString();
            if (!tpls.Contains(tpl) || !UnderRoot(item.ParentId, roots, parentOf)) continue;

            var count = (int)(item.Upd?.StackObjectsCount ?? 1);
            var fir = item.Upd?.SpawnedInSession == true ? count : 0;
            result[tpl] = result.TryGetValue(tpl, out var held)
                ? new ItemHolding(held.Count + count, held.Fir + fir)
                : new ItemHolding(count, fir);
        }

        return result;
    }

    private static bool UnderRoot(string? parentId, HashSet<string> roots, Dictionary<string, string?> parentOf)
    {
        for (var depth = 0; parentId is not null && depth < MaxDepth; depth++)
        {
            if (roots.Contains(parentId)) return true;
            if (!parentOf.TryGetValue(parentId, out parentId)) return false;
        }

        return false;
    }
}

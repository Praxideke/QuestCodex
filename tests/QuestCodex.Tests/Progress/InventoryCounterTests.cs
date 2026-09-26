using QuestCodex.Progress;
using QuestCodex.Progress.Models;
using SPTarkov.Server.Core.Models.Common;
using SPTarkov.Server.Core.Models.Eft.Common.Tables;
using static QuestCodex.Tests.Fixtures;

namespace QuestCodex.Tests.Progress;

public class InventoryCounterTests
{
    private static readonly MongoId Stash = Id(100), Equipment = Id(101), Rack = Id(102);
    private static readonly MongoId Gas = Id(7001), Ledx = Id(7002), Junk = Id(7003), CaseTpl = Id(7010), RackTpl = Id(7011);
    private static readonly HashSet<string> Targets = [Gas.ToString(), Ledx.ToString()];

    private static Item Placed(int id, MongoId tpl, MongoId parent, string slot = "hideout", double? stack = null, bool? fir = null) => new()
    {
        Id = Id(id), Template = tpl, ParentId = parent.ToString(), SlotId = slot,
        Upd = stack is null && fir is null ? null : new Upd { StackObjectsCount = stack, SpawnedInSession = fir },
    };

    private static BotBaseInventory Inventory(params Item[] items) => new()
    {
        Items = [new Item { Id = Stash, Template = Id(7100) }, new Item { Id = Equipment, Template = Id(7101) },
                 new Item { Id = Rack, Template = RackTpl }, .. items],
        Stash = Stash,
        Equipment = Equipment,
        HideoutAreaStashes = new() { ["24"] = Rack },
    };

    [Fact]
    public void Counts_stash_items_with_stack_and_fir()
    {
        var inv = Inventory(
            Placed(1, Gas, Stash, fir: true),
            Placed(2, Gas, Stash),                        // upd 없음 → 1개, 비FIR
            Placed(3, Ledx, Stash, stack: 3, fir: false));

        var result = InventoryCounter.Count(inv, Targets);

        Assert.Equal(new ItemHolding(2, 1), result[Gas.ToString()]);
        Assert.Equal(new ItemHolding(3, 0), result[Ledx.ToString()]);
    }

    [Fact]
    public void Counts_items_nested_in_containers_and_equipment()
    {
        var inv = Inventory(
            Placed(10, CaseTpl, Stash),
            Placed(11, Gas, Id(10), "main", fir: true),       // 창고 속 케이스 안
            Placed(20, CaseTpl, Equipment, "SecuredContainer"),
            Placed(21, Gas, Id(20), "main", fir: true),       // 입은 보안 컨테이너 안
            Placed(22, Ledx, Equipment, "Earpiece"));          // 입은 장비 자체

        var result = InventoryCounter.Count(inv, Targets);

        Assert.Equal(new ItemHolding(2, 2), result[Gas.ToString()]);
        Assert.Equal(new ItemHolding(1, 0), result[Ledx.ToString()]);
    }

    [Fact]
    public void Skips_hideout_area_stashes_and_detached_items()
    {
        var inv = Inventory(
            Placed(30, Gas, Rack, "main", fir: true),          // 은신처 진열대 — 제출 창에 안 뜬다
            Placed(31, Gas, Id(999), "main", fir: true));      // 부모가 인벤토리에 없음

        Assert.Empty(InventoryCounter.Count(inv, Targets));
    }

    [Fact]
    public void Ignores_non_target_items_and_omits_zero_counts()
    {
        var inv = Inventory(Placed(40, Junk, Stash, stack: 50));

        Assert.Empty(InventoryCounter.Count(inv, Targets));
    }

    [Fact]
    public void Parent_cycle_does_not_hang()
    {
        var inv = Inventory(Placed(50, Gas, Id(51)), Placed(51, CaseTpl, Id(50)));

        Assert.Empty(InventoryCounter.Count(inv, Targets));
    }

    [Fact]
    public void Null_inventory_or_items_are_tolerated()
    {
        Assert.Empty(InventoryCounter.Count(null, Targets));
        Assert.Empty(InventoryCounter.Count(new BotBaseInventory { Items = null, Stash = Stash }, Targets));
    }
}

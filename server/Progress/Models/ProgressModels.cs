using QuestCodex.Catalog.Models;

namespace QuestCodex.Progress.Models;

public sealed record ObjectiveProgress(double Current, double? Target, bool Done);

public sealed record QuestProgress(
    string Status,
    DateTimeOffset? StartTime,
    DateTimeOffset? FinishTime,
    IReadOnlyList<LockReason> LockReasons,
    SortedDictionary<string, ObjectiveProgress> Objectives);

public sealed class TraderStats
{
    public int Total { get; set; }
    public int Success { get; set; }
    public int Started { get; set; }
    public int AvailableForStart { get; set; }
    public int Locked { get; set; }
    public int Other { get; set; }
}

/// <summary>퀘스트 아이템 하나의 보유 수. Fir 은 Count 중 레이드 획득(FIR) 수.</summary>
public sealed record ItemHolding(int Count, int Fir);

public sealed record ProfileProgress(
    string ProfileId,
    string Nickname,
    int? Level,
    string? Side,
    bool IsActive,
    SortedDictionary<string, QuestProgress> Quests,
    SortedDictionary<string, TraderStats> TraderStats,
    SortedDictionary<string, ItemHolding> Inventory,
    IReadOnlyList<CatalogWarning> Warnings);

public sealed record ProfileSummary(
    string Id,
    string Nickname,
    int? Level,
    string? Side,
    bool HasCharacter,
    bool IsActive,
    DateTimeOffset? LastSessionAt);

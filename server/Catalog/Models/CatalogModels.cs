namespace QuestCodex.Catalog.Models;

public static class WarningCodes
{
    public const string DanglingPrereq = "danglingPrereq";
    public const string MissingLocale = "missingLocale";
    public const string UnknownTrader = "unknownTrader";
    public const string BadId = "badId";
    public const string UnparsedCondition = "unparsedCondition";
    public const string UnparsedReward = "unparsedReward";
    public const string EmptyRewardItems = "emptyRewardItems";
    public const string BuildFailed = "buildFailed";
    public const string OrphanQuest = "orphanQuest";
    public const string VanillaSnapshotMissing = "vanillaSnapshotMissing";
    public const string VanillaSnapshotMismatch = "vanillaSnapshotMismatch";
    public const string ModQuestScanFailed = "modQuestScanFailed";
    public const string ModQuestIdCollision = "modQuestIdCollision";
    public const string QuestZoneSnapshotMissing = "questZoneSnapshotMissing";
    public const string QuestZoneNotFound = "questZoneNotFound";
}

public sealed record CatalogWarning(string? QuestId, string Code, string Detail);

public sealed record CatalogTrader(string Id, string Name, string? AvatarUrl, bool IsVanilla);

public sealed record Objective(
    string ConditionId, string ConditionType, string Text, double? TargetCount, string? TargetName, ObjectivePrep? Prep = null)
{
    /// <summary>
    /// 목표 위치(맵별 Unity 좌표). 좌표를 알 수 없는 조건이면 빈 목록. 레코드 동등성이 목록을 참조로 비교하므로
    /// 빈 값은 항상 공유 인스턴스(Array.Empty)를 쓴다 — LocationResolver 도 같은 인스턴스를 돌려준다.
    /// </summary>
    public IReadOnlyList<ObjectiveLocation> Locations { get; init; } = Array.Empty<ObjectiveLocation>();
}

/// <summary>Unity 월드 좌표 그대로. Y = 높이. SVG 투영은 브라우저가 한다.</summary>
public sealed record MapPoint(double X, double Y, double Z);

/// <summary>Map = SPT locations 폴더 키(소문자, 예: bigmap, sandbox_high).</summary>
public sealed record ObjectiveLocation(string Map, IReadOnlyList<MapPoint> Points);

/// <summary>스냅샷의 잠긴 문 한 개. Type = 덤프의 컴포넌트 이름("Door" | "KeycardDoor").</summary>
public sealed record SnapshotDoor(string KeyTpl, string Type, MapPoint Position);

/// <summary>
/// 카탈로그에 싣는 잠긴 문. Kind = "door" | "keycard". KeyTpl 은 지금 화면에서 쓰지 않고, 나중에 프로필 인벤토리와
/// 대조해 보유 열쇠를 표시할 때의 키다(06 스펙 §4.3).
/// </summary>
public sealed record LockedDoor(string KeyTpl, string KeyName, string Kind, MapPoint Position);

public sealed record QuestRewards(
    IReadOnlyList<CatalogReward> Started,
    IReadOnlyList<CatalogReward> Success,
    IReadOnlyList<CatalogReward> Fail);

public sealed class CatalogQuest
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required string TraderId { get; init; }
    public required string Side { get; init; }
    public string? FactionOnly { get; init; }
    public bool IsVanilla { get; init; }
    /// <summary>IsVanilla=false 인 퀘스트에서만 채워진다. 출처 모드를 못 찾으면(예: CustomQuestService 로 주입) null.</summary>
    public string? ModName { get; init; }
    public string? ImageUrl { get; init; }
    public int? MinLevel { get; init; }
    /// <summary>퀘스트가 묶인 맵의 표시 이름. "any" 이거나 이름을 못 찾으면 null.</summary>
    public string? Location { get; init; }
    public required IReadOnlyList<Requirement> Requirements { get; init; }
    public required IReadOnlyList<string> Prerequisites { get; init; }
    /// <summary>빌더가 전체 순회 후 채운다. ID 오름차순.</summary>
    public List<string> Unlocks { get; } = [];
    public required IReadOnlyList<Objective> Objectives { get; init; }
    public required QuestRewards Rewards { get; init; }
    /// <summary>"isolated" | "traderInternal". 빌더가 Unlocks 확정 후 채운다.</summary>
    public List<string> Tags { get; } = [];
}

public sealed record Catalog(
    string SptVersion,
    string ModVersion,
    DateTimeOffset GeneratedAt,
    string Lang,
    SortedDictionary<string, CatalogTrader> Traders,
    SortedDictionary<string, CatalogQuest> Quests,
    SortedDictionary<string, List<string>> RewardIndex,
    IReadOnlyList<CatalogWarning> Warnings,
    /// <summary>map 키 → 잠긴 문. 퀘스트와 무관하게 맵마다 한 번만 싣는다(위치정보 팝업의 잠긴 문 토글).</summary>
    SortedDictionary<string, List<LockedDoor>> LockedDoors);

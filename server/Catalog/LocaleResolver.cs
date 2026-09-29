namespace QuestCodex.Catalog;

/// <summary>요청 언어 → en → 원문 순서로 텍스트를 찾는다. 폴백 여부를 호출자에게 알린다.</summary>
public sealed class LocaleResolver(
    IReadOnlyDictionary<string, string> locale,
    IReadOnlyDictionary<string, string> fallback)
{
    public string Resolve(string key, string fallbackText, out bool fellBack)
    {
        if (locale.TryGetValue(key, out var text) && !string.IsNullOrWhiteSpace(text))
        {
            fellBack = false;
            return text;
        }

        fellBack = true;
        if (fallback.TryGetValue(key, out var fallbackValue) && !string.IsNullOrWhiteSpace(fallbackValue))
        {
            return fallbackValue;
        }

        return fallbackText;
    }

    /// <summary>
    /// 후보 키를 순서대로 — 요청 언어에서 전부 먼저 찾고, 없으면 en 에서 같은 순서로. 빈 키·중복은 건너뛴다.
    /// fellBack 은 요청 언어에 어느 키도 없었다는 뜻이다.
    /// </summary>
    public string Resolve(IEnumerable<string?> keys, string fallbackText, out bool fellBack)
    {
        var candidates = keys.Where(k => !string.IsNullOrWhiteSpace(k)).Select(k => k!).Distinct(StringComparer.Ordinal).ToList();
        foreach (var key in candidates)
        {
            if (locale.TryGetValue(key, out var text) && !string.IsNullOrWhiteSpace(text))
            {
                fellBack = false;
                return text;
            }
        }

        fellBack = true;
        foreach (var key in candidates)
        {
            if (fallback.TryGetValue(key, out var text) && !string.IsNullOrWhiteSpace(text)) return text;
        }

        return fallbackText;
    }

    /// <summary>키가 어느 로케일에도 없을 때 null. 폴백 텍스트가 없는 선택 필드용.</summary>
    public string? TryResolve(string key)
    {
        if (locale.TryGetValue(key, out var text) && !string.IsNullOrWhiteSpace(text)) return text;
        if (fallback.TryGetValue(key, out var fb) && !string.IsNullOrWhiteSpace(fb)) return fb;
        return null;
    }
}

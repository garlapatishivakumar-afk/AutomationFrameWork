using System.Text.Json;

namespace AIAutomationGenerator.Business;

public static class BusinessVocabulary
{
    public static readonly IReadOnlyDictionary<string, string[]> Verbs =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["Login"] = ["login", "log in", "signin", "sign in", "authenticate"],
            ["Approve"] = ["approve", "approval", "authorize"],
            ["Delete"] = ["delete", "remove"],
            ["Download"] = ["download", "export"],
            ["Upload"] = ["upload", "import"],
            ["Generate"] = ["generate", "build"],
            ["Retrieve"] = ["retrieve", "get", "fetch"],
            ["Search"] = ["search", "find", "lookup", "filter", "query"],
            ["Update"] = ["update", "edit", "modify", "change"],
            ["View"] = ["view", "open", "details", "detail"],
            ["Create"] = ["create", "new", "add", "save", "submit"]
        };

    public static readonly IReadOnlyDictionary<string, string[]> Nouns =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["Authentication"] = ["login", "log in", "signin", "sign in", "password", "username", "email"],
            ["Loan Reconciliation"] = ["recon", "reconciliation", "loan recon", "loan reconciliation"],
            ["External Wire"] = ["external wire", "pending wire", "wire transfer", "outgoing wire"],
            ["Wire"] = ["wire", "swift"],
            ["Portfolio Deal"] = ["portfolio deal", "deal number", "open deal"],
            ["Portfolio"] = ["portfolio"],
            ["Deal"] = ["deal", "tranche"],
            ["Cash Management Account"] = ["cash mgmt account", "cash management account", "cash account"],
            ["Account"] = ["account", "cash mgmt account", "cash management account"],
            ["Work Queue"] = ["work queue", "dgworkqueue", "workqueue"],
            ["Loan Queue"] = ["loan queue", "loanqueue"],
            ["Cash Queue"] = ["cash queue", "cashqueue"],
            ["Reserve Queue"] = ["reserve queue", "reservequeue"],
            ["Document Queue"] = ["document queue", "documentqueue", "doc queue"],
            ["Run As User"] = ["whoiam", "who i am", "run as user", "impersonation"],
            ["Dashboard"] = ["dashboard", "powerbi", "viewer"],
            ["Report"] = ["report", "statement"],
            ["Loan"] = ["loan", "facility"]
        };

    public static readonly IReadOnlySet<string> StopWords =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "the", "and", "for", "with", "from", "into", "onto", "your", "this", "that", "button", "input",
            "textbox", "field", "label", "click", "fill", "select", "check", "press", "wait", "page", "frame",
            "main", "window", "locator", "role", "name", "text", "test", "id", "value", "get", "by",
            "aria", "async", "await", "new", "var", "const", "let", "string", "int", "double", "bool",
            "true", "false", "null", "page1", "page2", "buttons", "webforms", "aspx", "https", "http"
        };

    private static readonly Lazy<IReadOnlyDictionary<string, string[]>> mergedNouns =
        new(LoadMergedNouns);

    public static IReadOnlyDictionary<string, string[]> GetNouns()
    {
        return mergedNouns.Value;
    }

    private static IReadOnlyDictionary<string, string[]> LoadMergedNouns()
    {
        Dictionary<string, HashSet<string>> map = new(StringComparer.OrdinalIgnoreCase);

        foreach ((string noun, string[] keywords) in Nouns)
        {
            EnsureEntry(map, noun).UnionWith(keywords.Where(k => !string.IsNullOrWhiteSpace(k)));
        }

        foreach (string filePath in EnumerateDictionaryFiles())
        {
            foreach ((string noun, IEnumerable<string> keywords) in ReadDictionaryEntries(filePath))
            {
                if (string.IsNullOrWhiteSpace(noun))
                {
                    continue;
                }

                HashSet<string> entry = EnsureEntry(map, noun.Trim());
                foreach (string keyword in keywords)
                {
                    if (!string.IsNullOrWhiteSpace(keyword))
                    {
                        entry.Add(keyword.Trim());
                    }
                }

                if (entry.Count == 0)
                {
                    entry.Add(noun.Trim());
                }
            }
        }

        return map.ToDictionary(
            kv => kv.Key,
            kv => kv.Value.ToArray(),
            StringComparer.OrdinalIgnoreCase);
    }

    private static HashSet<string> EnsureEntry(Dictionary<string, HashSet<string>> map, string noun)
    {
        if (!map.TryGetValue(noun, out HashSet<string>? keywords))
        {
            keywords = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            map[noun] = keywords;
        }

        return keywords;
    }

    private static IEnumerable<string> EnumerateDictionaryFiles()
    {
        List<string> roots = new();

        if (!string.IsNullOrWhiteSpace(Directory.GetCurrentDirectory()))
        {
            roots.Add(Directory.GetCurrentDirectory());
        }

        string baseDir = AppContext.BaseDirectory;
        if (!string.IsNullOrWhiteSpace(baseDir) && !roots.Contains(baseDir, StringComparer.OrdinalIgnoreCase))
        {
            roots.Add(baseDir);
        }

        foreach (string root in roots.ToArray())
        {
            DirectoryInfo? current = new(root);
            for (int depth = 0; depth < 5 && current is not null; depth++)
            {
                string businessDictionary = Path.Combine(current.FullName, "BusinessDictionary.json");
                if (File.Exists(businessDictionary))
                {
                    yield return businessDictionary;
                }

                string frameworkContext = Path.Combine(current.FullName, "FrameworkContext.json");
                if (File.Exists(frameworkContext))
                {
                    yield return frameworkContext;
                }

                string aiRecorderFrameworkContext = Path.Combine(current.FullName, "AIRecorder", "FrameworkContext.json");
                if (File.Exists(aiRecorderFrameworkContext))
                {
                    yield return aiRecorderFrameworkContext;
                }

                current = current.Parent;
            }
        }
    }

    private static IEnumerable<(string noun, IEnumerable<string> keywords)> ReadDictionaryEntries(string filePath)
    {
        List<(string noun, IEnumerable<string> keywords)> entries = [];

        try
        {
            using JsonDocument document = JsonDocument.Parse(File.ReadAllText(filePath));
            JsonElement root = document.RootElement;

            foreach ((string noun, IEnumerable<string> keywords) in ReadEntriesFromElement(root))
            {
                entries.Add((noun, keywords));
            }
        }
        catch
        {
            return entries;
        }

        return entries;
    }

    private static IEnumerable<(string noun, IEnumerable<string> keywords)> ReadEntriesFromElement(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            if (element.TryGetProperty("Nouns", out JsonElement nounsSection))
            {
                foreach ((string noun, IEnumerable<string> keywords) in ReadEntriesFromElement(nounsSection))
                {
                    yield return (noun, keywords);
                }
            }

            if (element.TryGetProperty("BusinessObjects", out JsonElement objectsSection))
            {
                foreach ((string noun, IEnumerable<string> keywords) in ReadEntriesFromElement(objectsSection))
                {
                    yield return (noun, keywords);
                }
            }

            foreach (JsonProperty property in element.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.Array)
                {
                    string[] values = property.Value
                        .EnumerateArray()
                        .Where(v => v.ValueKind == JsonValueKind.String)
                        .Select(v => v.GetString() ?? string.Empty)
                        .Where(v => !string.IsNullOrWhiteSpace(v))
                        .ToArray();

                    if (values.Length > 0)
                    {
                        yield return (property.Name, values);
                    }
                }
            }

            yield break;
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (JsonElement item in element.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    string value = item.GetString() ?? string.Empty;
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        yield return (value.Trim(), [value.Trim()]);
                    }
                }
                else if (item.ValueKind == JsonValueKind.Object)
                {
                    string name = string.Empty;
                    if (item.TryGetProperty("Name", out JsonElement nameProp) && nameProp.ValueKind == JsonValueKind.String)
                    {
                        name = nameProp.GetString() ?? string.Empty;
                    }
                    else if (item.TryGetProperty("Noun", out JsonElement nounProp) && nounProp.ValueKind == JsonValueKind.String)
                    {
                        name = nounProp.GetString() ?? string.Empty;
                    }

                    if (string.IsNullOrWhiteSpace(name))
                    {
                        continue;
                    }

                    List<string> keywords = new() { name.Trim() };
                    if (item.TryGetProperty("Keywords", out JsonElement keywordsProp) && keywordsProp.ValueKind == JsonValueKind.Array)
                    {
                        keywords.AddRange(
                            keywordsProp
                                .EnumerateArray()
                                .Where(v => v.ValueKind == JsonValueKind.String)
                                .Select(v => v.GetString() ?? string.Empty)
                                .Where(v => !string.IsNullOrWhiteSpace(v))
                                .Select(v => v.Trim()));
                    }

                    yield return (name.Trim(), keywords);
                }
            }
        }
    }
}

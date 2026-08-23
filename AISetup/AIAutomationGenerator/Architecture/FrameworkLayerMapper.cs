using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Architecture;

/// <summary>
/// V3.0 — Maps a requested component to the correct Automation Framework layer.
/// Derives conventions from the actual scanned repository rather than hard-coding them.
/// </summary>
public class FrameworkLayerMapper : IFrameworkLayerMapper
{
    public FrameworkLayerMapping Map(
        string componentType,
        string businessIntent,
        RepositoryMetadata metadata)
    {
        // Derive layer mappings from the actual discovered framework structure
        var layers = DiscoverLayers(metadata);

        // Match by component type first
        var key = Normalize(componentType);

        if (layers.TryGetValue(key, out var discovered))
        {
            return new FrameworkLayerMapping
            {
                Layer            = discovered.layer,
                FolderPath       = discovered.folder,
                NamingConvention = discovered.naming,
                Namespace        = discovered.ns,
                Confidence       = 0.92,
                Reason           = $"Layer derived from scanned repository: {discovered.folder}"
            };
        }

        // Fall back to business intent keywords
        return MapByIntent(businessIntent, layers);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Layer discovery from repository metadata
    // ──────────────────────────────────────────────────────────────────────────

    private static Dictionary<string, (string layer, string folder, string naming, string ns)>
        DiscoverLayers(RepositoryMetadata metadata)
    {
        var map = new Dictionary<string, (string, string, string, string)>(StringComparer.OrdinalIgnoreCase);

        // Derive from scanned locators (PageElements)
        var locatorFiles = metadata.Locators
            .Select(l => l.FilePath)
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Distinct()
            .ToList();

        if (locatorFiles.Any())
        {
            string folder = Path.GetDirectoryName(locatorFiles.First())?.Split(Path.DirectorySeparatorChar).LastOrDefault() ?? "PageElements";
            string ns     = ExtractNamespace(locatorFiles.First()) ?? "AutomationFrameWork.PageElements";
            map["locator"]      = ("PageElements", folder, "{Page}Objects.cs", ns);
            map["pageelements"] = ("PageElements", folder, "{Page}Objects.cs", ns);
            map["elements"]     = ("PageElements", folder, "{Page}Objects.cs", ns);
        }

        // Derive from scanned methods (PageActions)
        var methodFiles = metadata.Methods
            .Where(m => m.FilePath.Contains("PageActions", StringComparison.OrdinalIgnoreCase)
                     || m.ClassName.EndsWith("Methods", StringComparison.OrdinalIgnoreCase))
            .Select(m => m.FilePath)
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Distinct()
            .ToList();

        if (methodFiles.Any())
        {
            string folder = Path.GetDirectoryName(methodFiles.First())?.Split(Path.DirectorySeparatorChar).LastOrDefault() ?? "PageActions";
            string ns     = ExtractNamespace(methodFiles.First()) ?? "AutomationFrameWork.PageActions";
            map["method"]     = ("PageActions", folder, "{Page}Methods.cs", ns);
            map["pageactions"] = ("PageActions", folder, "{Page}Methods.cs", ns);
            map["action"]     = ("PageActions", folder, "{Page}Methods.cs", ns);
        }

        // Derive from scanned steps (StepDefinitions)
        var stepFiles = metadata.Steps
            .Select(s => s.FilePath)
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Distinct()
            .ToList();

        if (stepFiles.Any())
        {
            string folder = Path.GetDirectoryName(stepFiles.First())?.Split(Path.DirectorySeparatorChar).LastOrDefault() ?? "StepDefinitions";
            string ns     = ExtractNamespace(stepFiles.First()) ?? "AutomationFrameWork.StepDefinitions";
            map["step"]             = ("StepDefinitions", folder, "{Page}Steps.cs", ns);
            map["stepdefinitions"]  = ("StepDefinitions", folder, "{Page}Steps.cs", ns);
            map["stepdefinition"]   = ("StepDefinitions", folder, "{Page}Steps.cs", ns);
        }

        // Derive from scanned features
        var featureFiles = metadata.Features
            .Select(f => f.FilePath)
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Distinct()
            .ToList();

        if (featureFiles.Any())
        {
            string folder = Path.GetDirectoryName(featureFiles.First())?.Split(Path.DirectorySeparatorChar).LastOrDefault() ?? "Features";
            map["feature"]  = ("Features", folder, "{Area}.feature", "");
            map["scenario"] = ("Features", folder, "{Area}.feature", "");
        }

        // Derive from scanned utilities (Helpers)
        var utilFiles = metadata.Utilities
            .Select(u => u.FilePath)
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Distinct()
            .ToList();

        if (utilFiles.Any())
        {
            string folder = Path.GetDirectoryName(utilFiles.First())?.Split(Path.DirectorySeparatorChar).LastOrDefault() ?? "Helpers";
            string ns     = ExtractNamespace(utilFiles.First()) ?? "AutomationFrameWork.Helpers";
            map["helper"]  = ("Helpers", folder, "{Name}.cs", ns);
            map["utility"] = ("Helpers", folder, "{Name}.cs", ns);
            map["helpers"] = ("Helpers", folder, "{Name}.cs", ns);
        }

        // Sensible defaults if metadata is empty
        if (!map.ContainsKey("locator"))
            map["locator"] = ("PageElements", "PageElements", "{Page}Objects.cs", "AutomationFrameWork.PageElements");
        if (!map.ContainsKey("method"))
            map["method"] = ("PageActions", "PageActions", "{Page}Methods.cs", "AutomationFrameWork.PageActions");
        if (!map.ContainsKey("step"))
            map["step"] = ("StepDefinitions", "StepDefinitions", "{Page}Steps.cs", "AutomationFrameWork.StepDefinitions");
        if (!map.ContainsKey("feature"))
            map["feature"] = ("Features", "Features", "{Area}.feature", "");
        if (!map.ContainsKey("helper"))
            map["helper"] = ("Helpers", "Helpers", "{Name}.cs", "AutomationFrameWork.Helpers");

        return map;
    }

    private static FrameworkLayerMapping MapByIntent(
        string intent,
        Dictionary<string, (string layer, string folder, string naming, string ns)> layers)
    {
        string lower = intent.ToLowerInvariant();

        if (lower.Contains("locator") || lower.Contains("selector") || lower.Contains("element"))
            return ToResult(layers["locator"], 0.7, "Business intent suggests UI element");

        if (lower.Contains("action") || lower.Contains("click") || lower.Contains("fill")
            || lower.Contains("navigate") || lower.Contains("select"))
            return ToResult(layers["method"], 0.7, "Business intent suggests UI action");

        if (lower.Contains("step") || lower.Contains("given") || lower.Contains("when")
            || lower.Contains("then"))
            return ToResult(layers["step"], 0.7, "Business intent suggests step definition");

        if (lower.Contains("scenario") || lower.Contains("feature") || lower.Contains("test"))
            return ToResult(layers["feature"], 0.65, "Business intent suggests feature/scenario");

        if (lower.Contains("helper") || lower.Contains("util") || lower.Contains("common"))
            return ToResult(layers["helper"], 0.65, "Business intent suggests helper/utility");

        // Default to PageActions when uncertain
        return ToResult(layers["method"], 0.5, "Defaulted to PageActions (no clear intent match)");
    }

    private static FrameworkLayerMapping ToResult(
        (string layer, string folder, string naming, string ns) t,
        double confidence,
        string reason) => new()
    {
        Layer            = t.layer,
        FolderPath       = t.folder,
        NamingConvention = t.naming,
        Namespace        = t.ns,
        Confidence       = confidence,
        Reason           = reason
    };

    private static string? ExtractNamespace(string filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
            return null;
        try
        {
            foreach (var line in File.ReadLines(filePath))
            {
                var trimmed = line.Trim();
                if (trimmed.StartsWith("namespace ", StringComparison.Ordinal))
                    return trimmed["namespace ".Length..].TrimEnd(';', ' ', '{');
            }
        }
        catch { /* non-critical */ }
        return null;
    }

    private static string Normalize(string s) => s.ToLowerInvariant().Replace(" ", "");
}

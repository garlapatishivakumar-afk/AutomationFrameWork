using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

/// <summary>
/// V3.0 — Maps a required component to the correct Automation Framework layer
/// (PageElements / PageActions / StepDefinitions / Features / Helpers).
/// </summary>
public interface IFrameworkLayerMapper
{
    /// <summary>
    /// Determines the correct layer for the given component type and context.
    /// Returns the layer name and the relative folder path within the framework.
    /// </summary>
    FrameworkLayerMapping Map(string componentType, string businessIntent, RepositoryMetadata metadata);
}

/// <summary>Result of a framework layer mapping decision.</summary>
public class FrameworkLayerMapping
{
    /// <summary>PageElements / PageActions / StepDefinitions / Features / Helpers</summary>
    public string Layer { get; set; } = string.Empty;

    /// <summary>Relative folder path (e.g. "PageElements", "StepDefinitions").</summary>
    public string FolderPath { get; set; } = string.Empty;

    /// <summary>File naming convention for this layer (e.g. "{Page}Objects.cs").</summary>
    public string NamingConvention { get; set; } = string.Empty;

    /// <summary>Expected namespace (e.g. "AutomationFrameWork.PageElements").</summary>
    public string Namespace { get; set; } = string.Empty;

    /// <summary>Confidence in this mapping.</summary>
    public double Confidence { get; set; }

    /// <summary>Reason for this layer selection.</summary>
    public string Reason { get; set; } = string.Empty;
}

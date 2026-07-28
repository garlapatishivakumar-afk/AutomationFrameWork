using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using System.Text;
using System.Text.RegularExpressions;

namespace AIAutomationGenerator.Generation;

public class FileGenerator : IFileGenerator
{
    private readonly GeneratorOutputSettings generatorOutputSettings;

    public FileGenerator(GeneratorOutputSettings generatorOutputSettings)
    {
        this.generatorOutputSettings = generatorOutputSettings ?? new GeneratorOutputSettings();
    }

    public async Task GenerateAsync(
        AIResponseModel responseModel,
        string outputFolder,
        RepositoryMetadata metadata,
        string repositoryPath)
    {
        responseModel ??= new AIResponseModel();
        metadata ??= new RepositoryMetadata();

        string artifactName = BuildArtifactName(responseModel.FeatureFile);
        string repositoryRoot = Path.GetFullPath(repositoryPath);

        string reportsFolder = ResolveFolder(
            generatorOutputSettings.ReportsFolder,
            outputFolder);

        string configuredFeaturesFolder = ResolveFolder(
            generatorOutputSettings.FeaturesFolder,
            Path.Combine(reportsFolder, "Features"));

        string configuredPageElementsFolder = ResolveFolder(
            generatorOutputSettings.PageElementsFolder,
            Path.Combine(reportsFolder, "PageElements"));

        string configuredPageActionsFolder = ResolveFolder(
            generatorOutputSettings.PageActionsFolder,
            Path.Combine(reportsFolder, "PageActions"));

        string configuredStepDefinitionsFolder = ResolveFolder(
            generatorOutputSettings.StepDefinitionsFolder,
            Path.Combine(reportsFolder, "StepDefinitions"));

        string configuredUtilitiesFolder = ResolveFolder(
            generatorOutputSettings.UtilitiesFolder,
            Path.Combine(reportsFolder, "Utilities"));

        string featuresFolder = configuredFeaturesFolder;
        string pageElementsFolder = configuredPageElementsFolder;
        string pageActionsFolder = configuredPageActionsFolder;
        string stepDefinitionsFolder = configuredStepDefinitionsFolder;
        string utilitiesFolder = configuredUtilitiesFolder;

        if (generatorOutputSettings.AutoDetectFoldersFromMetadata)
        {
            featuresFolder = DetectFeaturesFolder(
                metadata,
                repositoryRoot,
                configuredFeaturesFolder);

            pageElementsFolder = DetectPageElementsFolder(
                metadata,
                repositoryRoot,
                configuredPageElementsFolder);

            pageActionsFolder = DetectPageActionsFolder(
                metadata,
                repositoryRoot,
                configuredPageActionsFolder);

            stepDefinitionsFolder = DetectStepDefinitionsFolder(
                metadata,
                repositoryRoot,
                configuredStepDefinitionsFolder);

            utilitiesFolder = DetectUtilitiesFolder(
                metadata,
                repositoryRoot,
                configuredUtilitiesFolder);
        }

        Directory.CreateDirectory(reportsFolder);
        Directory.CreateDirectory(featuresFolder);
        Directory.CreateDirectory(pageElementsFolder);
        Directory.CreateDirectory(pageActionsFolder);
        Directory.CreateDirectory(stepDefinitionsFolder);
        Directory.CreateDirectory(utilitiesFolder);

        await WriteWithStrategyAsync(
            featuresFolder,
            $"{artifactName}.feature",
            responseModel.FeatureFile ?? string.Empty,
            generatorOutputSettings.ExistingFileStrategy);

        await WriteWithStrategyAsync(
            pageElementsFolder,
            $"{artifactName}Objects.cs",
            responseModel.PageObjects ?? string.Empty,
            generatorOutputSettings.ExistingFileStrategy);

        await WriteWithStrategyAsync(
            pageActionsFolder,
            $"{artifactName}Methods.cs",
            responseModel.Methods ?? string.Empty,
            generatorOutputSettings.ExistingFileStrategy);

        await WriteWithStrategyAsync(
            stepDefinitionsFolder,
            $"{artifactName}Steps.cs",
            responseModel.StepDefinitions ?? string.Empty,
            generatorOutputSettings.ExistingFileStrategy);

        await WriteWithStrategyAsync(
            utilitiesFolder,
            $"{artifactName}Utilities.cs",
            responseModel.Utilities ?? string.Empty,
            generatorOutputSettings.ExistingFileStrategy);

        await WriteWithStrategyAsync(
            reportsFolder,
            $"{artifactName}ValidationMessages.cs",
            responseModel.ValidationMessages ?? string.Empty,
            generatorOutputSettings.ExistingFileStrategy);
    }

    private static string ResolveFolder(string configuredPath, string fallbackPath)
    {
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            return fallbackPath;
        }

        return Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, configuredPath));
    }

    private static string BuildArtifactName(string featureFileContent)
    {
        string rawFeatureName = ExtractFeatureName(featureFileContent);
        if (string.IsNullOrWhiteSpace(rawFeatureName))
        {
            return "Generated";
        }

        string[] tokens = Regex
            .Split(rawFeatureName, "[^A-Za-z0-9]+")
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToArray();

        if (tokens.Length == 0)
        {
            return "Generated";
        }

        var builder = new StringBuilder();
        foreach (string token in tokens)
        {
            builder.Append(char.ToUpperInvariant(token[0]));
            if (token.Length > 1)
            {
                builder.Append(token[1..]);
            }
        }

        return builder.ToString();
    }

    private static string ExtractFeatureName(string featureFileContent)
    {
        if (string.IsNullOrWhiteSpace(featureFileContent))
        {
            return string.Empty;
        }

        string[] lines = featureFileContent
            .Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);

        foreach (string rawLine in lines)
        {
            string line = rawLine.Trim();
            if (!line.StartsWith("Feature:", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return line["Feature:".Length..].Trim();
        }

        return string.Empty;
    }

    private static async Task WriteWithStrategyAsync(
        string folder,
        string fileName,
        string content,
        ExistingFileStrategy strategy)
    {
        string targetPath = Path.Combine(folder, fileName);
        if (!File.Exists(targetPath) || strategy == ExistingFileStrategy.Replace)
        {
            await File.WriteAllTextAsync(targetPath, content);
            return;
        }

        if (strategy == ExistingFileStrategy.Cancel)
        {
            throw new InvalidOperationException(
                $"File already exists and strategy is Cancel: {targetPath}");
        }

        string copyPath = GetNextVersionedPath(targetPath);
        await File.WriteAllTextAsync(copyPath, content);
    }

    private static string GetNextVersionedPath(string existingPath)
    {
        string directory = Path.GetDirectoryName(existingPath) ?? string.Empty;
        string baseName = Path.GetFileNameWithoutExtension(existingPath);
        string extension = Path.GetExtension(existingPath);

        int version = 2;
        while (true)
        {
            string candidate = Path.Combine(directory, $"{baseName}_v{version}{extension}");
            if (!File.Exists(candidate))
            {
                return candidate;
            }

            version++;
        }
    }

    private static string DetectFeaturesFolder(
        RepositoryMetadata metadata,
        string repositoryRoot,
        string fallback)
    {
        IEnumerable<string> candidates = metadata.Features
            .Select(x => x.FilePath)
            .Where(x => x.EndsWith(".feature", StringComparison.OrdinalIgnoreCase));

        return SelectDirectory(candidates, repositoryRoot, "features", fallback);
    }

    private static string DetectStepDefinitionsFolder(
        RepositoryMetadata metadata,
        string repositoryRoot,
        string fallback)
    {
        IEnumerable<string> candidates = metadata.Steps
            .Select(x => x.FilePath)
            .Where(x => x.EndsWith(".cs", StringComparison.OrdinalIgnoreCase));

        return SelectDirectory(candidates, repositoryRoot, "stepdefinitions", fallback);
    }

    private static string DetectPageElementsFolder(
        RepositoryMetadata metadata,
        string repositoryRoot,
        string fallback)
    {
        IEnumerable<string> candidates = metadata.Locators
            .Select(x => x.FilePath)
            .Where(x => x.EndsWith(".cs", StringComparison.OrdinalIgnoreCase));

        return SelectDirectory(candidates, repositoryRoot, "pageelements", fallback);
    }

    private static string DetectPageActionsFolder(
        RepositoryMetadata metadata,
        string repositoryRoot,
        string fallback)
    {
        IEnumerable<string> candidates = metadata.Methods
            .Select(x => x.FilePath)
            .Where(x => x.EndsWith(".cs", StringComparison.OrdinalIgnoreCase));

        return SelectDirectory(candidates, repositoryRoot, "pageactions", fallback);
    }

    private static string DetectUtilitiesFolder(
        RepositoryMetadata metadata,
        string repositoryRoot,
        string fallback)
    {
        IEnumerable<string> candidates = metadata.Utilities
            .Select(x => x.FilePath)
            .Where(x => x.EndsWith(".cs", StringComparison.OrdinalIgnoreCase));

        return SelectDirectory(candidates, repositoryRoot, "utilities", fallback);
    }

    private static string SelectDirectory(
        IEnumerable<string> filePaths,
        string repositoryRoot,
        string preferredDirectoryName,
        string fallback)
    {
        List<string> normalized = filePaths
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(Path.GetFullPath)
            .Select(Path.GetDirectoryName)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!)
            .Where(x => IsInsideRoot(x, repositoryRoot))
            .Where(x => !ContainsIgnoredSegment(x))
            .ToList();

        if (normalized.Count == 0)
        {
            return fallback;
        }

        string? preferred = normalized
            .Where(x => string.Equals(
                Path.GetFileName(x),
                preferredDirectoryName,
                StringComparison.OrdinalIgnoreCase))
            .GroupBy(x => x, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(x => x.Count())
            .Select(x => x.Key)
            .FirstOrDefault();

        if (!string.IsNullOrWhiteSpace(preferred))
        {
            return preferred;
        }

        // Use configured output when metadata does not clearly point to a dedicated target folder.
        return fallback;
    }

    private static bool IsInsideRoot(string path, string root)
    {
        string normalizedPath = Path.GetFullPath(path)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string normalizedRoot = Path.GetFullPath(root)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

        return normalizedPath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase);
    }

    private static bool ContainsIgnoredSegment(string path)
    {
        string[] segments = path.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return segments.Any(x =>
            x.Equals("GeneratedOutput", StringComparison.OrdinalIgnoreCase)
            || x.Equals("bin", StringComparison.OrdinalIgnoreCase)
            || x.Equals("obj", StringComparison.OrdinalIgnoreCase));
    }
}
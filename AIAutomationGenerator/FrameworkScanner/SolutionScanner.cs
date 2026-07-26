using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Configuration;
using AIAutomationGenerator.Shared;
using AIAutomationGenerator.Exporters;
using AIAutomationGenerator.Intelligence;

namespace AIAutomationGenerator.FrameworkScanner;

public class SolutionScanner : IFrameworkScanner
{
    private readonly ScannerSettings settings;
    private readonly ILogger logger;
    private readonly IFeatureParser featureParser;
    private readonly IMetadataExporter metadataExporter;
    private readonly IRelationshipBuilder relationshipBuilder;

    public SolutionScanner(
        ScannerSettings? settings = null,
        ILogger? logger = null,
        IFeatureParser? featureParser = null,
        IMetadataExporter? metadataExporter = null,
        IRelationshipBuilder? relationshipBuilder = null)
    {
        this.settings = settings ?? new ScannerSettings();
        this.logger = logger ?? new ConsoleLogger();
        this.featureParser = featureParser ?? new FeatureParser();
        this.metadataExporter = metadataExporter ?? new MetadataExporter();
        this.relationshipBuilder = relationshipBuilder ?? new RelationshipBuilder();
    }
    public async Task<RepositoryMetadata> ScanAsync(string repositoryPath)
    {
        RepositoryMetadata metadata = new();
        logger.LogInformation($"Scanning Repository: {repositoryPath}");
        IReadOnlyList<IRepositoryScanner> scanners = ScannerFactory.CreateScanners(settings, featureParser, logger);
        foreach (var scanner in scanners)
        {
            try
            {
                await scanner.ScanAsync(repositoryPath, metadata);
            }
            catch (Exception exception)
            {
                logger.LogError($"Scanner {scanner.GetType().Name} failed.", exception);
            }
        }
        relationshipBuilder.Build(metadata);

        string exportFolder = string.IsNullOrWhiteSpace(settings.OutputFolder)
            ? Path.Combine(repositoryPath, "MetadataOutput")
            : settings.OutputFolder;

        await metadataExporter.ExportAsync(metadata, exportFolder);
        return metadata;
    }
}
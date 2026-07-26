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
    private readonly IRepositoryIndexService repositoryIndexService;

    public SolutionScanner(
        ScannerSettings? settings = null,
        ILogger? logger = null,
        IFeatureParser? featureParser = null,
        IMetadataExporter? metadataExporter = null,
        IRelationshipBuilder? relationshipBuilder = null,
        IRepositoryIndexService? repositoryIndexService = null)
    {
        this.settings = settings ?? new ScannerSettings();
        this.logger = logger ?? new ConsoleLogger();
        this.featureParser = featureParser ?? new FeatureParser();
        this.metadataExporter = metadataExporter ?? new MetadataExporter();
        this.relationshipBuilder = relationshipBuilder ?? new RelationshipBuilder();
        this.repositoryIndexService = repositoryIndexService ?? new RepositoryIndexService(new ConsoleLogger());
    }
    public async Task<RepositoryMetadata> ScanAsync(string repositoryPath)
    {
        RepositoryMetadata metadata = await repositoryIndexService.GetOrBuildAsync(repositoryPath, async () =>
        {
            RepositoryMetadata scannedMetadata = new();
            logger.LogInformation($"Scanning Repository: {repositoryPath}");
            IReadOnlyList<IRepositoryScanner> scanners = ScannerFactory.CreateScanners(settings, featureParser, logger);
            foreach (var scanner in scanners)
            {
                try
                {
                    await scanner.ScanAsync(repositoryPath, scannedMetadata);
                }
                catch (Exception exception)
                {
                    logger.LogError($"Scanner {scanner.GetType().Name} failed.", exception);
                }
            }
            relationshipBuilder.Build(scannedMetadata);
            return scannedMetadata;
        });

        string exportFolder = string.IsNullOrWhiteSpace(settings.OutputFolder)
            ? Path.Combine(repositoryPath, "MetadataOutput")
            : settings.OutputFolder;

        await metadataExporter.ExportAsync(metadata, exportFolder);
        return metadata;
    }
}
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Shared;

namespace AIAutomationGenerator.FrameworkScanner;

public class FeatureScanner : IRepositoryScanner
{
    private readonly IFeatureParser featureParser;
    private readonly ILogger logger;

    public FeatureScanner(IFeatureParser featureParser, ILogger logger)
    {
        this.featureParser = featureParser;
        this.logger = logger;
    }

    public Task ScanAsync(string repositoryPath, RepositoryMetadata metadata)
    {
        logger.LogInformation($"Scanning feature files in: {repositoryPath}");

        foreach (var file in FileHelper.GetFiles(repositoryPath, "*.feature"))
        {
            try
            {
                metadata.Features.Add(featureParser.Parse(file));
            }
            catch (Exception exception)
            {
                logger.LogError($"Unable to parse feature file '{file}'.", exception);
            }
        }

        return Task.CompletedTask;
    }
}
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Shared;

namespace AIAutomationGenerator.FrameworkScanner;

public class UtilityScanner : IRepositoryScanner
{
    private readonly IUtilityParser utilityParser;
    private readonly ILogger logger;

    public UtilityScanner(IUtilityParser utilityParser, ILogger logger)
    {
        this.utilityParser = utilityParser;
        this.logger = logger;
    }

    public Task ScanAsync(string repositoryPath, RepositoryMetadata metadata)
    {
        logger.LogInformation($"Scanning utilities in {repositoryPath}");

        foreach (var file in FileHelper.GetFiles(repositoryPath, "*.cs"))
        {
            try
            {
                var utilities = utilityParser.Parse(file);

                metadata.Utilities.AddRange(utilities);
            }
            catch (Exception ex)
            {
                logger.LogError($"Unable to parse utilities from {file}", ex);
            }
        }

        return Task.CompletedTask;
    }
}
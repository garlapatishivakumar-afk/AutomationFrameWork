using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Shared;

namespace AIAutomationGenerator.FrameworkScanner;

public class LocatorScanner : IRepositoryScanner
{
    private readonly ILocatorParser locatorParser;
    private readonly ILogger logger;

    public LocatorScanner(ILocatorParser locatorParser, ILogger logger)
    {
        this.locatorParser = locatorParser;
        this.logger = logger;
    }

    public Task ScanAsync(string repositoryPath, RepositoryMetadata metadata)
    {
        logger.LogInformation($"Scanning locators in {repositoryPath}");

        foreach (string file in FileHelper.GetFiles(repositoryPath, "*.cs"))
        {
            try
            {
                IEnumerable<LocatorModel> locators = locatorParser.Parse(file);

                metadata.Locators.AddRange(locators);
            }
            catch (Exception exception)
            {
                logger.LogError($"Unable to parse locators from '{file}'.", exception);
            }
        }

        return Task.CompletedTask;
    }
}
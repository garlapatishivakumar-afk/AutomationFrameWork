using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Shared;

namespace AIAutomationGenerator.FrameworkScanner;

public class StepDefinitionScanner : IRepositoryScanner
{
    private readonly IStepDefinitionParser stepParser;
    private readonly ILogger logger;

    public StepDefinitionScanner(IStepDefinitionParser stepParser, ILogger logger)
    {
        this.stepParser = stepParser;
        this.logger = logger;
    }

    public Task ScanAsync(string repositoryPath, RepositoryMetadata metadata)
    {
        logger.LogInformation($"Scanning step definitions in {repositoryPath}");

        foreach (string file in FileHelper.GetFiles(repositoryPath, "*.cs"))
        {
            try
            {
                IEnumerable<StepDefinitionModel> steps = stepParser.Parse(file);

                metadata.Steps.AddRange(steps);
            }
            catch (Exception exception)
            {
                logger.LogError($"Unable to parse step definitions from '{file}'.", exception);
            }
        }

        return Task.CompletedTask;
    }
}
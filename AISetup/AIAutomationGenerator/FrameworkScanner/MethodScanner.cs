using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Shared;

namespace AIAutomationGenerator.FrameworkScanner;

public class MethodScanner : IRepositoryScanner
{
    private readonly IMethodParser methodParser;
    private readonly ILogger logger;

    public MethodScanner(
        IMethodParser methodParser,
        ILogger logger)
    {
        this.methodParser = methodParser;
        this.logger = logger;
    }

    public Task ScanAsync(
        string repositoryPath,
        RepositoryMetadata metadata)
    {
        logger.LogInformation($"Scanning methods in {repositoryPath}");
        var files = FileHelper.GetFiles(repositoryPath, "*.cs");

        foreach (var file in files)
        {
            try
            {
                var methods = methodParser.Parse(file);
                metadata.Methods.AddRange(methods);
            }
            catch (Exception ex)
            {
                logger.LogError($"Unable to parse methods from {file}",ex);
            }
        }

        return Task.CompletedTask;
    }
}
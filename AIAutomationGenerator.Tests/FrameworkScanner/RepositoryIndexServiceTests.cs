using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.FrameworkScanner;

public class RepositoryIndexServiceTests : IDisposable
{
    private readonly string repositoryPath;

    public RepositoryIndexServiceTests()
    {
        repositoryPath = Path.Combine(Path.GetTempPath(), "repo-index-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(repositoryPath);
    }

    [Fact]
    public async Task GetOrBuildAsync_UsesCachedIndex_WhenRepositoryIsUnchanged()
    {
        var service = new RepositoryIndexService(new NullLogger());
        var buildCount = 0;

        var first = await service.GetOrBuildAsync(repositoryPath, () =>
        {
            buildCount++;
            return Task.FromResult(CreateMetadata("Login"));
        });

        var second = await service.GetOrBuildAsync(repositoryPath, () =>
        {
            buildCount++;
            return Task.FromResult(CreateMetadata("Logout"));
        });

        Assert.Single(first.Features);
        Assert.Equal("Login", first.Features[0].Name);
        Assert.Equal(1, buildCount);
        Assert.Equal("Login", second.Features[0].Name);
    }

    [Fact]
    public async Task GetOrBuildAsync_Rebuilds_WhenRepositoryChanges()
    {
        var service = new RepositoryIndexService(new NullLogger());
        var buildCount = 0;

        await service.GetOrBuildAsync(repositoryPath, () =>
        {
            buildCount++;
            return Task.FromResult(CreateMetadata("Login"));
        });

        File.WriteAllText(Path.Combine(repositoryPath, "NewFile.cs"), "class NewFile {}" );

        await service.GetOrBuildAsync(repositoryPath, () =>
        {
            buildCount++;
            return Task.FromResult(CreateMetadata("Login"));
        });

        Assert.Equal(2, buildCount);
    }

    [Fact]
    public async Task GetOrBuildAsync_IgnoresIgnoredFolders_WhenCheckingForChanges()
    {
        var service = new RepositoryIndexService(new NullLogger());
        var buildCount = 0;

        await service.GetOrBuildAsync(repositoryPath, () =>
        {
            buildCount++;
            return Task.FromResult(CreateMetadata("Login"));
        });

        Directory.CreateDirectory(Path.Combine(repositoryPath, "bin"));
        File.WriteAllText(Path.Combine(repositoryPath, "bin", "ignored.cs"), "ignored");

        await service.GetOrBuildAsync(repositoryPath, () =>
        {
            buildCount++;
            return Task.FromResult(CreateMetadata("Login"));
        });

        Assert.Equal(1, buildCount);
    }

    public void Dispose()
    {
        if (Directory.Exists(repositoryPath))
        {
            Directory.Delete(repositoryPath, recursive: true);
        }
    }

    private static RepositoryMetadata CreateMetadata(string featureName)
    {
        return new RepositoryMetadata
        {
            Features =
            [
                new FeatureModel { Name = featureName, FilePath = "Features/Login.feature" }
            ],
            Steps =
            [
                new StepDefinitionModel { StepText = "Given I login", MethodName = "Login", FilePath = "StepDefinitions/LoginSteps.cs" }
            ],
            Methods =
            [
                new MethodModel { Name = "Login", ClassName = "LoginPage", FilePath = "PageActions/LoginPage.cs" }
            ],
            Locators =
            [
                new LocatorModel { Name = "UserName", PageName = "LoginPage", FilePath = "PageElements/LoginLocators.cs" }
            ],
            Utilities =
            [
                new UtilityModel { Name = "ExcelHelper", FilePath = "Helpers/ExcelHelper.cs", Methods = ["ReadData"] }
            ],
            Relationships =
            [
                new RelationshipModel { Source = "Login", Target = "UserName", RelationshipType = "Uses" }
            ]
        };
    }

    private sealed class NullLogger : ILogger
    {
        public void LogInformation(string message) { }

        public void LogError(string message, Exception exception) { }
    }
}

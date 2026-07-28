using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests;

public class RepositoryScannerIntegrationTests : IDisposable
{
    private readonly string repositoryPath;

    public RepositoryScannerIntegrationTests()
    {
        repositoryPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(repositoryPath);

        SeedRepository(repositoryPath);
    }

    [Fact]
    public async Task ScanAsync_ParsesRepository_AndBuildsRelationships()
    {
        SolutionScanner scanner = new();
        RepositoryMetadata metadata = await scanner.ScanAsync(repositoryPath);

        Assert.NotNull(metadata);
        Assert.NotEmpty(metadata.Features);
        Assert.NotEmpty(metadata.Methods);
        Assert.NotEmpty(metadata.Locators);
        Assert.NotEmpty(metadata.Steps);
        Assert.NotEmpty(metadata.Utilities);

        Assert.Contains(metadata.Relationships, r => r.RelationshipType == "StepCallsMethod");
        Assert.Contains(metadata.Relationships, r => r.RelationshipType == "MethodUsesLocator");
    }

    private static void SeedRepository(string path)
    {
        string feature = """
Feature: Login

Scenario: Login works
Given user logs in
""";

        string pageCode = """
using Reqnroll;

namespace Sample;

public class LoginPage
{
    public string LoginButton => "#login";

    [Given("user logs in")]
    public void UserLogsIn()
    {
        LoginButton.ToString();
    }
}
""";

        string utilityCode = """
namespace Sample;

public class CommonUtility
{
    public static void Trace() { }
}
""";

        File.WriteAllText(Path.Combine(path, "Login.feature"), feature);
        File.WriteAllText(Path.Combine(path, "LoginPage.cs"), pageCode);
        File.WriteAllText(Path.Combine(path, "CommonUtility.cs"), utilityCode);
    }

    public void Dispose()
    {
        if (Directory.Exists(repositoryPath))
        {
            Directory.Delete(repositoryPath, true);
        }
    }
}

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
using Microsoft.Playwright;
using Reqnroll;

namespace Sample;

public class LoginPage
{
    public ILocator LoginButton(IPage page) => page.Locator("#login");

    [Given("user logs in")]
    public void UserLogsIn(IPage page)
    {
        LoginButton(page).ClickAsync();
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

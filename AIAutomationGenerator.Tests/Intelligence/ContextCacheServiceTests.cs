using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.Intelligence;

public class ContextCacheServiceTests : IDisposable
{
    private readonly string repositoryPath;

    public ContextCacheServiceTests()
    {
        repositoryPath = Path.Combine(
            Path.GetTempPath(),
            Guid.NewGuid().ToString());

        Directory.CreateDirectory(repositoryPath);
    }

    [Fact]
    public async Task SaveAndLoadContext()
    {
        var service = new ContextCacheService();

        var package = new ContextPackage
        {
            Confidence = 0.9
        };

        package.Items.Add(new ContextItem
        {
            Name = "Login",
            Type = "Feature"
        });

        await service.SaveAsync(repositoryPath, package);

        Assert.True(service.Exists(repositoryPath));

        var loaded = await service.LoadAsync(repositoryPath);

        Assert.NotNull(loaded);
        Assert.Single(loaded.Items);
        Assert.Equal("Login", loaded.Items[0].Name);
    }

    public void Dispose()
    {
        if (Directory.Exists(repositoryPath))
        {
            Directory.Delete(repositoryPath, true);
        }
    }
}

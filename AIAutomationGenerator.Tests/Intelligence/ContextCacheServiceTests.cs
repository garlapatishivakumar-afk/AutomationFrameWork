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
        const string fingerprint = "abc123";

        var package = new ContextPackage
        {
            Confidence = 0.9,
            Fingerprint = fingerprint,
            GeneratorVersion = "2.0",
            CreatedOn = DateTime.UtcNow
        };

        package.Items.Add(new ContextItem
        {
            Name = "Login",
            Type = "Feature"
        });

        await service.SaveAsync(repositoryPath, package);

        Assert.True(service.IsCacheValid(repositoryPath, fingerprint));
        Assert.False(service.IsCacheValid(repositoryPath, "mismatch"));

        var loaded = await service.LoadAsync(repositoryPath);

        Assert.NotNull(loaded);
        Assert.Single(loaded.Items);
        Assert.Equal("Login", loaded.Items[0].Name);
        Assert.Equal(fingerprint, loaded.Fingerprint);
        Assert.Equal("2.0", loaded.GeneratorVersion);
    }

    public void Dispose()
    {
        if (Directory.Exists(repositoryPath))
        {
            Directory.Delete(repositoryPath, true);
        }
    }
}

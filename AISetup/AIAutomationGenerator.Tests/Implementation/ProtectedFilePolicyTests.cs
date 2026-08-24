using AIAutomationGenerator.Safety;
using Xunit;

namespace AIAutomationGenerator.Tests.Implementation
{
    public class ProtectedFilePolicyTests
    {
        [Theory]
        [InlineData("Hooks/Hooks.cs")]
        [InlineData("DriverFactory/PlaywrightDriver.cs")]
        [InlineData("XunitAssembly.cs")]
        [InlineData("ImplicitUsings.cs")]
        [InlineData("appsettings.json")]
        [InlineData("AISetup/AIAutomationGenerator/AIAutomationGenerator.csproj")]
        [InlineData(".github/workflows/ci.yml")]
        [InlineData("config/pipeline.yaml")]
        public void Policy_DetectsProtectedFiles(string path)
        {
            var policy = new ProtectedFilePolicy();
            Assert.True(policy.IsProtected(path));
        }

        [Fact]
        public void Policy_DoesNotProtectRegularPageObject()
        {
            var policy = new ProtectedFilePolicy();
            Assert.False(policy.IsProtected("PageElements/ViewDashboardObjects.cs"));
        }
    }
}

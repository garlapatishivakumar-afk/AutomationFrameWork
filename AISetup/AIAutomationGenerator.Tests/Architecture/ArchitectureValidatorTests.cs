using AIAutomationGenerator.Architecture;
using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.Architecture;

public class ArchitectureValidatorTests
{
    private readonly ArchitectureValidator validator = new(new ScriptValidator());

    [Fact]
    public void Validate_ReuseAction_AlwaysPasses()
    {
        var change = new ImplementationChange { Action = "REUSE" };
        var result = validator.Validate(change, Path.GetTempPath());
        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void Validate_ForbiddenPattern_ThreadSleep_FailsValidation()
    {
        var change = new ImplementationChange
        {
            Action           = "CREATE",
            ComponentType    = "PageActions",
            GeneratedContent = "public async Task WaitAsync() { Thread.Sleep(1000); }"
        };
        var result = validator.Validate(change, Path.GetTempPath());
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("Thread.Sleep"));
    }

    [Fact]
    public void Validate_HardcodedUrl_ProducesWarning()
    {
        var change = new ImplementationChange
        {
            Action           = "CREATE",
            ComponentType    = "PageActions",
            GeneratedContent = "public async Task GoAsync() { await page.GotoAsync(\"https://example.com\"); }"
        };
        var result = validator.Validate(change, Path.GetTempPath());
        Assert.Contains(result.Warnings, w => w.Contains("Hardcoded URL"));
    }

    [Fact]
    public void Validate_PageElementsNamingViolation_ProducesWarning()
    {
        var change = new ImplementationChange
        {
            Action        = "CREATE",
            ComponentType = "PageElements",
            ClassName     = "LoginPage",  // Should end with "Objects"
            GeneratedContent = "public class LoginPage { }"
        };
        var result = validator.Validate(change, Path.GetTempPath());
        Assert.Contains(result.Warnings, w => w.Contains("Objects"));
    }

    [Fact]
    public void Validate_PageActionsNoAsync_ProducesWarning()
    {
        var change = new ImplementationChange
        {
            Action           = "CREATE",
            ComponentType    = "PageActions",
            GeneratedContent = "public class Foo { public void Click() { } }"
        };
        var result = validator.Validate(change, Path.GetTempPath());
        Assert.Contains(result.Warnings, w => w.Contains("async"));
    }

    [Fact]
    public void ValidatePlan_DuplicateCreate_FailsValidation()
    {
        var plan = new ImplementationPlan();
        plan.Changes.Add(new ImplementationChange { Action = "CREATE", FilePath = "PageActions/FooMethods.cs" });
        plan.Changes.Add(new ImplementationChange { Action = "CREATE", FilePath = "PageActions/FooMethods.cs" });

        var result = validator.ValidatePlan(plan, Path.GetTempPath());

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("Duplicate CREATE"));
    }

    [Fact]
    public void ValidatePlan_EmptyPlan_Passes()
    {
        var result = validator.ValidatePlan(new ImplementationPlan(), Path.GetTempPath());
        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }
}

using AIAutomationGenerator.Intelligence;
using Xunit;

namespace AIAutomationGenerator.Tests;

public class ScriptValidatorTests
{

    [Fact]
    public void Validate_ReturnsSuccess_WhenContentIsWellFormed()
    {
        var validator = new ScriptValidator();
        var result = validator.Validate("""
using System;
namespace Sample;
public class LoginPage
{
    public void ClickLogin() { }
}
""");

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }
}

using AIAutomationGenerator.Intelligence;
using Xunit;

namespace AIAutomationGenerator.Tests;

public class AIResponseParserTests
{
    [Fact]
    public void Parse_SeparatesSectionsIntoStructuredOutput()
    {
        var parser = new AIResponseParser();
        var response = """
Feature File:
Feature: Login

Page Objects:
public class LoginPage { }

Methods:
public void ClickLogin() { }

Step Definitions:
[Given("user logs in")]

Utilities:
public static string BuildToken() { }

Validation Messages:
All good
""";

        var model = parser.Parse(response);

        Assert.False(model.IsMalformed);
        Assert.Contains("Feature: Login", model.FeatureFile);
        Assert.Contains("LoginPage", model.PageObjects);
        Assert.Contains("ClickLogin", model.Methods);
        Assert.Contains("BuildToken", model.Utilities);
        Assert.Contains("All good", model.ValidationMessages);
    }
}

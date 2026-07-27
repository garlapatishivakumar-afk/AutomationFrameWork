using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class MockAIProvider : IAIProvider
{
    public Task<AIResponse> GenerateAsync(AIRequest request)
    {
        return Task.FromResult(new AIResponse
        {
            Success = true,
            Content = """
Feature File:
Feature: Login

Page Objects:
public class LoginPage { }

Methods:
public void ClickLogin() { }

Step Definitions:
[Given("user logs in")]

Utilities:
public static class Helper { }
"""
        });
    }
}
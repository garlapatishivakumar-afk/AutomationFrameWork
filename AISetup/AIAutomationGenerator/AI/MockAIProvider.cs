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

Scenario: Login
    Given user logs in

Page Objects:
using Microsoft.Playwright;

namespace Demo.Pages;

public class LoginPage
{
}

Methods:
using Demo.Pages;

namespace Demo.Methods;

public class LoginMethods
{
    public void Login()
    {
    }
}

Step Definitions:
using Reqnroll;

namespace Demo.Steps;

public class LoginSteps
{
    [Given("user logs in")]
    public void UserLogsIn()
    {
    }
}

Utilities:
using System;

namespace Demo.Utilities;

public static class Helper
{
}
"""
        });
    }
}
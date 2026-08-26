using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Optimization;

public interface IAiContextPackBuilder
{
    string BuildPack(
        ContextModel context,
        IReadOnlyList<RecordedActionIntelligence> actions,
        int maxMethods,
        int maxLocators,
        int maxSteps,
        int tokenBudgetChars);
}

public sealed class AiContextPackBuilder : IAiContextPackBuilder
{
    public string BuildPack(
        ContextModel context,
        IReadOnlyList<RecordedActionIntelligence> actions,
        int maxMethods,
        int maxLocators,
        int maxSteps,
        int tokenBudgetChars)
    {
        context ??= new ContextModel();

        var methods = context.Methods
            .OrderByDescending(m => m.Score)
            .Take(maxMethods)
            .ToList();

        var locators = context.Locators
            .OrderByDescending(l => l.Score)
            .Take(maxLocators)
            .ToList();

        var steps = context.Steps
            .OrderByDescending(s => s.Score)
            .Take(maxSteps)
            .ToList();

        var builder = new StringBuilder();
        builder.AppendLine("# Deterministic Context Pack");
        builder.AppendLine("## Actions");
        foreach (var action in actions.Take(25))
        {
            builder.AppendLine($"- {action.ActionType} | {action.Target} | {action.LocatorValue}");
        }

        builder.AppendLine("## Methods");
        foreach (var method in methods)
        {
            builder.AppendLine($"- {method.ClassName}.{method.Name} (Score: {method.Score:F2})");
        }

        builder.AppendLine("## Locators");
        foreach (var locator in locators)
        {
            builder.AppendLine($"- {locator.PageName}.{locator.Name} = {locator.Selector}");
        }

        builder.AppendLine("## Steps");
        foreach (var step in steps)
        {
            builder.AppendLine($"- {step.StepText} -> {step.MethodName}");
        }

        string pack = builder.ToString();
        if (pack.Length <= tokenBudgetChars)
        {
            return pack;
        }

        return pack.Substring(0, tokenBudgetChars);
    }
}
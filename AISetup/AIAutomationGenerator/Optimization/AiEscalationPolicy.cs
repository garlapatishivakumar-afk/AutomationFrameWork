using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Optimization;

public interface IAiEscalationPolicy
{
    bool ShouldEscalateToAi(ContextModel context, IReadOnlyList<RecordedActionIntelligence> actions, out string reason);
}

public sealed class AiEscalationPolicy : IAiEscalationPolicy
{
    public bool ShouldEscalateToAi(ContextModel context, IReadOnlyList<RecordedActionIntelligence> actions, out string reason)
    {
        if (context == null)
        {
            reason = "No deterministic context";
            return true;
        }

        int methodCount = context.Methods.Count;
        int locatorCount = context.Locators.Count;
        int stepCount = context.Steps.Count;

        bool sparseContext = methodCount < 2 || locatorCount < 2 || stepCount < 1;
        bool hasUnknownAction = actions.Any(a =>
            string.IsNullOrWhiteSpace(a.ActionType) ||
            string.Equals(a.ActionType, "unknown", StringComparison.OrdinalIgnoreCase));

        if (sparseContext || hasUnknownAction)
        {
            reason = sparseContext
                ? "Deterministic context is sparse"
                : "Unknown action intent detected";
            return true;
        }

        reason = "Deterministic context sufficient";
        return false;
    }
}
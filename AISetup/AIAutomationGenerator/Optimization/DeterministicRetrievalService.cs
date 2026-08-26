using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Knowledge;

namespace AIAutomationGenerator.Optimization;

public interface IDeterministicRetrievalService
{
    IReadOnlyList<KnowledgeItem> RankCandidates(
        IReadOnlyList<KnowledgeItem> knowledgeBase,
        IReadOnlyList<RecordedActionIntelligence> actions,
        int maxCandidates,
        out double confidence);
}

public sealed class DeterministicRetrievalService : IDeterministicRetrievalService
{
    public IReadOnlyList<KnowledgeItem> RankCandidates(
        IReadOnlyList<KnowledgeItem> knowledgeBase,
        IReadOnlyList<RecordedActionIntelligence> actions,
        int maxCandidates,
        out double confidence)
    {
        var selected = new List<Scored>();

        foreach (var item in knowledgeBase)
        {
            double score = Score(item, actions);
            if (score <= 0)
            {
                continue;
            }

            selected.Add(new Scored(item, score));
        }

        var deduped = selected
            .GroupBy(x => x.Entry.Id, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderByDescending(x => x.Score).First())
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.Entry.ComponentName, StringComparer.OrdinalIgnoreCase)
            .Take(maxCandidates)
            .ToList();

        UsageTelemetryService.Current?.IncrementRetrievalCandidates(deduped.Count);

        confidence = deduped.Count == 0
            ? 0
            : Math.Round(deduped.Average(x => x.Score), 3);

        return deduped.Select(x => x.Entry).ToList();
    }

    private static double Score(KnowledgeItem entry, IReadOnlyList<RecordedActionIntelligence> actions)
    {
        double score = 0;
        string haystack = $"{entry.ComponentName} {entry.Description} {entry.LocatorValue}";

        foreach (var action in actions)
        {
            if (!string.IsNullOrWhiteSpace(action.ActionType) && haystack.Contains(action.ActionType, StringComparison.OrdinalIgnoreCase))
            {
                score += 1.0;
            }

            if (!string.IsNullOrWhiteSpace(action.Target) && haystack.Contains(action.Target, StringComparison.OrdinalIgnoreCase))
            {
                score += 0.8;
            }

            if (!string.IsNullOrWhiteSpace(action.LocatorValue) && haystack.Contains(action.LocatorValue, StringComparison.OrdinalIgnoreCase))
            {
                score += 0.6;
            }

            if (!string.IsNullOrWhiteSpace(action.InferredPageContext) &&
                entry.RelevantPages.Any(p => p.Equals(action.InferredPageContext, StringComparison.OrdinalIgnoreCase)))
            {
                score += 0.75;
            }
        }

        if (entry.RelevantPages.Length > 0)
        {
            score += 0.1;
        }

        return Math.Round(score, 3);
    }

    private sealed record Scored(KnowledgeItem Entry, double Score);
}
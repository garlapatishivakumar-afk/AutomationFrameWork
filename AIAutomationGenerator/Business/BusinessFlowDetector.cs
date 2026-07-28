using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using System.Text.RegularExpressions;

namespace AIAutomationGenerator.Business;

public class BusinessFlowDetector : IBusinessFlowDetector
{
    private static readonly Regex TokenRegex = new(@"[A-Za-z][A-Za-z0-9]+", RegexOptions.Compiled);

    private const double LocatorArgumentWeight = 3.0;
    private const double LocatorValueWeight = 3.0;
    private const double TargetWeight = 2.0;
    private const double LocatorExpressionWeight = 2.0;
    private const double InputValueWeight = 1.0;
    private const double RawCodeWeight = 1.0;
    private const double VariableNameWeight = 2.2;
    private const double VerbKeywordMatchWeight = 2.0;
    private const double UrlSignalWeight = 2.4;
    private const double FrameSignalWeight = 2.0;
    private const double PopupSignalWeight = 1.8;
    private const double RepeatedActionPenalty = 0.6;
    private const double MaxSequenceBoost = 0.35;

    public BusinessFlowDetectionResult Detect(List<RecordingActionModel> actions)
    {
        if (actions is null || actions.Count == 0)
        {
            return CreateFallbackResult();
        }

        List<string> evidence = [];

        Dictionary<string, double> nounScores = ScoreNouns(actions, evidence);
        Dictionary<string, double> verbScores = ScoreVerbs(actions, evidence);

        string noun = ResolveNoun(nounScores, actions);
        string verb = ResolveVerb(verbScores, actions);
        string flowName = ComposeFlowName(verb, noun);

        (double nounTopScore, double nounSecondScore) = GetTopTwoScores(nounScores);
        (double verbTopScore, double verbSecondScore) = GetTopTwoScores(verbScores);
        double confidence = CalculateConfidence(flowName, nounTopScore, nounSecondScore, verbTopScore, verbSecondScore, actions.Count);

        return new BusinessFlowDetectionResult
        {
            FlowName = flowName,
            Verb = verb,
            Noun = noun,
            Confidence = confidence,
            Evidence = BuildEvidence(verb, noun, nounScores, verbScores, evidence)
        };
    }

    private static string ComposeFlowName(string verb, string noun)
    {
        if (string.IsNullOrWhiteSpace(noun) && string.IsNullOrWhiteSpace(verb))
        {
            return "Generated Flow";
        }

        if (string.IsNullOrWhiteSpace(noun))
        {
            return verb;
        }

        if (string.IsNullOrWhiteSpace(verb))
        {
            return noun;
        }

        return $"{verb} {noun}";
    }

    private static BusinessFlowDetectionResult CreateFallbackResult()
    {
        return new BusinessFlowDetectionResult
        {
            FlowName = "Generated Flow",
            Verb = string.Empty,
            Noun = string.Empty,
            Confidence = 0.18,
            Evidence = ["No actionable business signals detected."]
        };
    }

    private static Dictionary<string, double> ScoreNouns(List<RecordingActionModel> actions, List<string> evidence)
    {
        Dictionary<string, double> scores = new(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, int> seenSignals = new(StringComparer.OrdinalIgnoreCase);
        int popupSequenceIndex = actions.FindIndex(a => a.ActionType == "Popup" || a.IsPopupAction);

        for (int i = 0; i < actions.Count; i++)
        {
            RecordingActionModel action = actions[i];
            double sequenceFactor = GetSequenceWeight(i, actions.Count);
            double repetitionFactor = GetRepetitionWeight(GetAndTrackOccurrence(seenSignals, BuildSignalKey(action)));
            double dynamicFactor = sequenceFactor * repetitionFactor;

            AddNounScores(scores, action.LocatorArgument, LocatorArgumentWeight * dynamicFactor, evidence, "LocatorArgument");
            AddNounScores(scores, action.LocatorValue, LocatorValueWeight * dynamicFactor, evidence, "LocatorValue");
            AddNounScores(scores, action.Target, TargetWeight * dynamicFactor, evidence, "Target");
            AddNounScores(scores, action.LocatorExpression, LocatorExpressionWeight * dynamicFactor, evidence, "LocatorExpression");
            AddNounScores(scores, action.InputValue, InputValueWeight * dynamicFactor, evidence, "InputValue");
            AddNounScores(scores, action.RawCode, RawCodeWeight * dynamicFactor, evidence, "RawCode");
            AddNounScores(scores, action.VariableName, VariableNameWeight * dynamicFactor, evidence, "VariableName");

            AddUrlSignals(scores, action, dynamicFactor, evidence);
            AddFrameSignals(scores, action, dynamicFactor, evidence);
            AddBusinessObjectPhraseSignals(scores, action, dynamicFactor, evidence);

            if (popupSequenceIndex >= 0)
            {
                AddPopupNounSignals(scores, actions, i, popupSequenceIndex, dynamicFactor, evidence);
            }
        }

        ApplyNounCombinations(scores);
        return scores;
    }

    private static Dictionary<string, double> ScoreVerbs(List<RecordingActionModel> actions, List<string> evidence)
    {
        Dictionary<string, double> scores = new(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, int> seenSignals = new(StringComparer.OrdinalIgnoreCase);
        int popupSequenceIndex = actions.FindIndex(a => a.ActionType == "Popup" || a.IsPopupAction);
        bool hasNavigate = actions.Any(a => a.ActionType == "Navigate");
        bool hasExportSignal = actions.Any(a => ContainsAnyIgnoreCase(BuildCombinedSignal(a), "download", "export", "report", "statement"));
        bool hasValidation = actions.Any(a => a.ActionType == "Assert");

        for (int i = 0; i < actions.Count; i++)
        {
            RecordingActionModel action = actions[i];
            double sequenceFactor = GetSequenceWeight(i, actions.Count);
            double repetitionFactor = GetRepetitionWeight(GetAndTrackOccurrence(seenSignals, BuildSignalKey(action)));
            double dynamicFactor = sequenceFactor * repetitionFactor;

            string combined = BuildCombinedSignal(action).ToLowerInvariant();
            foreach ((string verb, string[] keywords) in BusinessVocabulary.Verbs)
            {
                foreach (string keyword in keywords)
                {
                    if (ContainsSignal(combined, keyword))
                    {
                        AddScore(scores, verb, VerbKeywordMatchWeight * dynamicFactor);
                        AddEvidence(evidence, $"Verb '{verb}' matched keyword '{keyword}'.");
                    }
                }
            }

            // Action type gives structural intent even when text labels are generic.
            switch (action.ActionType)
            {
                case "Upload":
                    AddScore(scores, "Upload", 3.0 * dynamicFactor);
                    break;
                case "Navigate":
                    AddScore(scores, "View", 1.5 * dynamicFactor);
                    break;
                case "Fill":
                case "Select":
                    AddScore(scores, "Create", 0.75 * dynamicFactor);
                    AddScore(scores, "Search", 0.75 * dynamicFactor);
                    break;
                case "Click":
                case "DoubleClick":
                    AddScore(scores, "View", 0.5 * dynamicFactor);
                    break;
                case "Assert":
                    AddScore(scores, "View", 0.5 * dynamicFactor);
                    break;
            }

            if (popupSequenceIndex >= 0)
            {
                AddPopupVerbSignals(scores, actions, i, popupSequenceIndex, dynamicFactor, evidence);
            }
        }

        ApplyNavigationOrderSignals(scores, actions, hasNavigate, popupSequenceIndex >= 0, hasExportSignal, hasValidation, evidence);

        if (scores.TryGetValue("Create", out double createScore)
            && scores.TryGetValue("Approve", out double approveScore)
            && approveScore >= createScore)
        {
            scores["Create"] = Math.Max(0, createScore - 0.5);
        }

        if (scores.TryGetValue("View", out double viewScore)
            && scores.TryGetValue("Retrieve", out double retrieveScore)
            && viewScore > 0)
        {
            scores["View"] = viewScore + (retrieveScore * 0.25);
        }

        return scores;
    }

    private static string ResolveNoun(Dictionary<string, double> nounScores, List<RecordingActionModel> actions)
    {
        if (nounScores.Count > 0)
        {
            return nounScores
                .OrderByDescending(kv => kv.Value)
                .ThenBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
                .First().Key;
        }

        List<string> fallbackTokens = actions
            .SelectMany(ExtractBusinessLabelTokens)
            .Where(t => t.Length > 2)
            .Where(t => !BusinessVocabulary.StopWords.Contains(t))
            .GroupBy(t => t)
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key, StringComparer.OrdinalIgnoreCase)
            .Select(g => ToTitle(g.Key))
            .Take(2)
            .ToList();

        return fallbackTokens.Count > 0
            ? string.Join(" ", fallbackTokens)
            : string.Empty;
    }

    private static string ResolveVerb(Dictionary<string, double> verbScores, List<RecordingActionModel> actions)
    {
        if (verbScores.Count > 0)
        {
            return verbScores
                .OrderByDescending(kv => kv.Value)
                .ThenBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
                .First().Key;
        }

        return actions.Any(a => a.ActionType == "Navigate" || a.ActionType == "Assert")
            ? "View"
            : "Create";
    }

    private static void AddNounScores(
        Dictionary<string, double> scores,
        string value,
        double weight,
        List<string>? evidence = null,
        string source = "Signal")
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        string normalized = NormalizeSignal(value);
        IReadOnlyDictionary<string, string[]> nounVocabulary = BusinessVocabulary.GetNouns();

        foreach ((string noun, string[] keywords) in nounVocabulary)
        {
            foreach (string keyword in keywords)
            {
                if (ContainsSignal(normalized, keyword))
                {
                    AddScore(scores, noun, weight);
                    AddEvidence(evidence, $"{source}: '{keyword}' -> noun '{noun}'.");
                }
            }
        }
    }

    private static void ApplyNounCombinations(Dictionary<string, double> scores)
    {
        double reconScore = GetScore(scores, "Loan Reconciliation");
        double loanScore = GetScore(scores, "Loan");
        if (reconScore > 0)
        {
            scores["Loan Reconciliation"] = reconScore + (loanScore * 0.5);
        }

        double wireScore = GetScore(scores, "Wire");
        double externalWireScore = GetScore(scores, "External Wire");
        if (wireScore > 0 && externalWireScore > 0)
        {
            scores["External Wire"] = externalWireScore + (wireScore * 0.35);
        }

        double portfolioScore = GetScore(scores, "Portfolio");
        double dealScore = GetScore(scores, "Deal");
        if (portfolioScore > 0 && dealScore > 0)
        {
            scores["Portfolio Deal"] = Math.Max(GetScore(scores, "Portfolio Deal"), portfolioScore + dealScore);
        }
    }

    private static string BuildCombinedSignal(RecordingActionModel action)
    {
        return string.Join(
            " ",
            action.Target,
            action.LocatorValue,
            action.LocatorExpression,
            action.LocatorArgument,
            action.InputValue,
            action.VariableName,
            action.Url,
            action.FrameName,
            action.WindowName,
            action.RawCode,
            action.ActionType);
    }

    private static IEnumerable<string> ExtractBusinessLabelTokens(RecordingActionModel action)
    {
        string signal = string.Join(
            " ",
            action.LocatorArgument,
            action.LocatorValue,
            action.InputValue,
            action.FrameName,
            action.Url,
            ExtractQuotedText(action.Target),
            ExtractQuotedText(action.RawCode));

        foreach (string token in ExtractTokensFromText(signal))
        {
            yield return token;
        }
    }

    private static void AddUrlSignals(Dictionary<string, double> scores, RecordingActionModel action, double factor, List<string> evidence)
    {
        if (string.IsNullOrWhiteSpace(action.Url) && !string.Equals(action.ActionType, "Navigate", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        string url = string.IsNullOrWhiteSpace(action.Url)
            ? ExtractUrlFromText(action.RawCode)
            : action.Url;

        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        string pageToken = ExtractUrlPageToken(url);
        if (string.IsNullOrWhiteSpace(pageToken))
        {
            return;
        }

        string normalizedPhrase = ToBusinessPhrase(pageToken);
        if (!string.IsNullOrWhiteSpace(normalizedPhrase))
        {
            AddEvidence(evidence, $"URL token '{pageToken}' interpreted as '{normalizedPhrase}'.");
            AddNounScores(scores, normalizedPhrase, UrlSignalWeight * factor, evidence, "URL");
            if (ContainsSignal(normalizedPhrase, "queue"))
            {
                AddNounScores(scores, "Work Queue", (UrlSignalWeight * 0.65) * factor, evidence, "URL");
            }
        }
    }

    private static void AddFrameSignals(Dictionary<string, double> scores, RecordingActionModel action, double factor, List<string> evidence)
    {
        if (string.IsNullOrWhiteSpace(action.FrameName) && !action.IsFrameAction)
        {
            return;
        }

        string frameSignal = string.Join(" ", action.FrameName, action.LocatorChain, action.RawCode);
        AddNounScores(scores, frameSignal, FrameSignalWeight * factor, evidence, "Frame");
        if (ContainsAnyIgnoreCase(frameSignal, "powerbi", "dashboard", "viewer", "report"))
        {
            AddNounScores(scores, "Dashboard Report Viewer", (FrameSignalWeight * 0.75) * factor, evidence, "Frame");
            AddEvidence(evidence, "Frame context suggests dashboard/report viewer workflow.");
        }
    }

    private static void AddPopupNounSignals(
        Dictionary<string, double> scores,
        List<RecordingActionModel> actions,
        int index,
        int popupSequenceIndex,
        double factor,
        List<string> evidence)
    {
        RecordingActionModel action = actions[index];
        bool isNearPopup = Math.Abs(index - popupSequenceIndex) <= 2;
        bool isPopupContext = action.IsPopupAction || isNearPopup;
        if (!isPopupContext)
        {
            return;
        }

        string popupSignal = string.Join(" ", action.WindowName, action.Target, action.LocatorValue, action.InputValue);
        AddNounScores(scores, popupSignal, PopupSignalWeight * factor, evidence, "Popup");
    }

    private static void AddPopupVerbSignals(
        Dictionary<string, double> scores,
        List<RecordingActionModel> actions,
        int index,
        int popupSequenceIndex,
        double factor,
        List<string> evidence)
    {
        RecordingActionModel action = actions[index];
        bool isNearPopup = Math.Abs(index - popupSequenceIndex) <= 2;
        bool isPopupContext = action.IsPopupAction || isNearPopup;
        if (!isPopupContext)
        {
            return;
        }

        string popupSignal = BuildCombinedSignal(action);
        if (ContainsAnyIgnoreCase(popupSignal, "view", "details", "recon", "retrieve", "get"))
        {
            AddScore(scores, "View", PopupSignalWeight * factor);
            AddScore(scores, "Retrieve", (PopupSignalWeight * 0.8) * factor);
            AddEvidence(evidence, "Popup action sequence boosted View/Retrieve intent.");
        }
    }

    private static void AddBusinessObjectPhraseSignals(Dictionary<string, double> scores, RecordingActionModel action, double factor, List<string> evidence)
    {
        foreach (string phrase in ExtractBusinessObjectPhrases(action))
        {
            AddNounScores(scores, phrase, (TargetWeight * 1.1) * factor, evidence, "Phrase");
        }
    }

    private static IEnumerable<string> ExtractBusinessObjectPhrases(RecordingActionModel action)
    {
        string signal = string.Join(
            " ",
            action.LocatorArgument,
            action.LocatorValue,
            action.InputValue,
            ExtractQuotedText(action.Target),
            ExtractQuotedText(action.RawCode));

        string normalized = NormalizeSignal(signal)
            .Replace("cash mgmt", "cash management", StringComparison.OrdinalIgnoreCase)
            .Replace("acct", "account", StringComparison.OrdinalIgnoreCase)
            .Replace("recon", "reconciliation", StringComparison.OrdinalIgnoreCase);

        string[] commonPhrases =
        [
            "cash management account",
            "loan reconciliation",
            "external wire",
            "portfolio deal",
            "work queue",
            "loan queue",
            "cash queue",
            "reserve queue",
            "document queue"
        ];

        foreach (string phrase in commonPhrases)
        {
            if (ContainsSignal(normalized, phrase))
            {
                yield return phrase;
            }
        }
    }

    private static void ApplyNavigationOrderSignals(
        Dictionary<string, double> scores,
        List<RecordingActionModel> actions,
        bool hasNavigate,
        bool hasPopup,
        bool hasExportSignal,
        bool hasValidation,
        List<string> evidence)
    {
        if (hasNavigate)
        {
            AddScore(scores, "View", 1.0);
        }

        if (hasPopup)
        {
            AddScore(scores, "View", 1.0);
            AddScore(scores, "Retrieve", 0.75);
        }

        if (hasExportSignal)
        {
            AddScore(scores, "Download", 1.2);
        }

        if (hasValidation && hasNavigate)
        {
            AddScore(scores, "View", 0.8);
        }

        int searchIndex = FirstIndexOfSignal(actions, "search", "find", "lookup", "filter");
        int popupIndex = actions.FindIndex(a => a.ActionType == "Popup" || a.IsPopupAction);
        int retrieveIndex = FirstIndexOfSignal(actions, "get recon", "retrieve", "fetch", "view recon", "reconciliation");

        if (searchIndex >= 0 && popupIndex > searchIndex && retrieveIndex > popupIndex)
        {
            AddScore(scores, "View", 1.2);
            AddScore(scores, "Retrieve", 1.4);
            AddEvidence(evidence, "Sequence pattern Search -> Popup -> Retrieve increased confidence.");
        }
        else if (popupIndex >= 0 && searchIndex > popupIndex)
        {
            AddScore(scores, "Search", 0.5);
            AddEvidence(evidence, "Popup occurred before Search; reduced retrieval bias.");
        }

        int navigateIndex = actions.FindIndex(a => a.ActionType == "Navigate");
        if (navigateIndex >= 0 && searchIndex > navigateIndex)
        {
            AddScore(scores, "View", 0.7);
            AddScore(scores, "Search", 0.5);
            AddEvidence(evidence, "Navigation followed by Search contributed to exploration flow intent.");
        }
    }

    private static int FirstIndexOfSignal(List<RecordingActionModel> actions, params string[] terms)
    {
        for (int i = 0; i < actions.Count; i++)
        {
            if (ContainsAnyIgnoreCase(BuildCombinedSignal(actions[i]), terms))
            {
                return i;
            }
        }

        return -1;
    }

    private static string BuildSignalKey(RecordingActionModel action)
    {
        string signal = string.Join(
            "|",
            action.ActionType,
            NormalizeSignal(action.LocatorArgument),
            NormalizeSignal(action.LocatorValue),
            NormalizeSignal(action.Url),
            NormalizeSignal(action.FrameName));

        return signal;
    }

    private static int GetAndTrackOccurrence(Dictionary<string, int> occurrences, string signalKey)
    {
        if (occurrences.TryGetValue(signalKey, out int count))
        {
            occurrences[signalKey] = count + 1;
            return count + 1;
        }

        occurrences[signalKey] = 1;
        return 1;
    }

    private static double GetSequenceWeight(int index, int total)
    {
        if (total <= 1)
        {
            return 1.0;
        }

        double progress = (double)index / (total - 1);
        return 1.0 + ((1.0 - progress) * MaxSequenceBoost);
    }

    private static double GetRepetitionWeight(int occurrence)
    {
        if (occurrence <= 1)
        {
            return 1.0;
        }

        return 1.0 / (1.0 + ((occurrence - 1) * RepeatedActionPenalty));
    }

    private static string NormalizeSignal(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        string normalized = value.ToLowerInvariant();
        normalized = normalized.Replace("_", " ", StringComparison.Ordinal)
            .Replace("-", " ", StringComparison.Ordinal)
            .Replace("/", " ", StringComparison.Ordinal)
            .Replace(".", " ", StringComparison.Ordinal);
        return Regex.Replace(normalized, "\\s+", " ").Trim();
    }

    private static string ExtractUrlFromText(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return string.Empty;
        }

        Match match = Regex.Match(content, @"https?://[^\""""'\s)]+", RegexOptions.IgnoreCase);
        return match.Success ? match.Value : string.Empty;
    }

    private static string ExtractUrlPageToken(string url)
    {
        try
        {
            Uri uri = new(url);
            string segment = uri.Segments.LastOrDefault() ?? string.Empty;
            string cleaned = Uri.UnescapeDataString(segment)
                .Replace(".aspx", string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace(".html", string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace(".htm", string.Empty, StringComparison.OrdinalIgnoreCase);

            cleaned = Regex.Replace(cleaned, "^(dg|btn|lnk|txt|ddl)", string.Empty, RegexOptions.IgnoreCase);
            return cleaned;
        }
        catch
        {
            return string.Empty;
        }
    }

    private static string ToBusinessPhrase(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return string.Empty;
        }

        IEnumerable<string> parts = SplitCamelCase(token)
            .Select(p => p.ToLowerInvariant())
            .Where(p => !BusinessVocabulary.StopWords.Contains(p));

        string phrase = string.Join(" ", parts);
        phrase = phrase.Replace("mgmt", "management", StringComparison.OrdinalIgnoreCase)
            .Replace("acct", "account", StringComparison.OrdinalIgnoreCase)
            .Replace("recon", "reconciliation", StringComparison.OrdinalIgnoreCase);

        return phrase.Trim();
    }

    private static IEnumerable<string> ExtractTokensFromText(string content)
    {
        foreach (Match match in TokenRegex.Matches(content))
        {
            string token = match.Value;
            foreach (string part in SplitCamelCase(token))
            {
                yield return part.ToLowerInvariant();
            }
        }
    }

    private static string ExtractQuotedText(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return string.Empty;
        }

        List<string> values = new();
        foreach (Match match in Regex.Matches(content, "\"([^\"]+)\"|\\'([^\\']+)\\'"))
        {
            string value = match.Groups[1].Success
                ? match.Groups[1].Value
                : match.Groups[2].Value;

            if (!string.IsNullOrWhiteSpace(value))
            {
                values.Add(value);
            }
        }

        return string.Join(" ", values);
    }

    private static IEnumerable<string> SplitCamelCase(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            yield break;
        }

        foreach (Match match in Regex.Matches(token, @"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+"))
        {
            if (!string.IsNullOrWhiteSpace(match.Value))
            {
                yield return match.Value;
            }
        }
    }

    private static bool ContainsSignal(string content, string keyword)
    {
        string normalizedContent = NormalizeSignal(content);
        string normalizedKeyword = NormalizeSignal(keyword);
        if (string.IsNullOrWhiteSpace(normalizedKeyword))
        {
            return false;
        }

        string escaped = Regex.Escape(normalizedKeyword);
        string pattern = normalizedKeyword.Contains(' ')
            ? escaped.Replace("\\ ", "\\s+")
            : $@"\b{escaped}\b";

        return Regex.IsMatch(normalizedContent, pattern, RegexOptions.IgnoreCase);
    }

    private static bool ContainsAnyIgnoreCase(string content, params string[] terms)
    {
        return terms.Any(term => ContainsSignal(content, term));
    }

    private static void AddScore(Dictionary<string, double> scores, string key, double value)
    {
        if (scores.TryGetValue(key, out double current))
        {
            scores[key] = current + value;
            return;
        }

        scores[key] = value;
    }

    private static double GetScore(Dictionary<string, double> scores, string key)
    {
        return scores.TryGetValue(key, out double score) ? score : 0;
    }

    private static string ToTitle(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return char.ToUpperInvariant(value[0]) + value[1..].ToLowerInvariant();
    }

    private static List<string> BuildEvidence(
        string verb,
        string noun,
        Dictionary<string, double> nounScores,
        Dictionary<string, double> verbScores,
        List<string> evidence)
    {
        List<string> result = [];

        if (!string.IsNullOrWhiteSpace(verb) && verbScores.TryGetValue(verb, out double verbScore))
        {
            result.Add($"Top verb '{verb}' scored {Math.Round(verbScore, 2)}.");
        }

        if (!string.IsNullOrWhiteSpace(noun) && nounScores.TryGetValue(noun, out double nounScore))
        {
            result.Add($"Top noun '{noun}' scored {Math.Round(nounScore, 2)}.");
        }

        foreach (string item in evidence.Where(e => !string.IsNullOrWhiteSpace(e)).Distinct(StringComparer.OrdinalIgnoreCase).Take(10))
        {
            result.Add(item);
        }

        return result;
    }

    private static void AddEvidence(List<string>? evidence, string message)
    {
        if (evidence is null || string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        if (evidence.Count < 80)
        {
            evidence.Add(message);
        }
    }

    private static (double first, double second) GetTopTwoScores(Dictionary<string, double> scores)
    {
        if (scores.Count == 0)
        {
            return (0, 0);
        }

        double first = scores.Values.Max();
        double second = scores.Values.Where(v => v < first).DefaultIfEmpty(0).Max();
        return (first, second);
    }

    private static double CalculateConfidence(
        string flowName,
        double nounTop,
        double nounSecond,
        double verbTop,
        double verbSecond,
        int actionCount)
    {
        if (string.Equals(flowName, "Generated Flow", StringComparison.OrdinalIgnoreCase))
        {
            return 0.18;
        }

        double nounConfidence = CalculateScoreConfidence(nounTop, nounSecond, 6.0);
        double verbConfidence = CalculateScoreConfidence(verbTop, verbSecond, 4.0);

        double confidence = (nounConfidence * 0.6) + (verbConfidence * 0.4);
        if (actionCount >= 3)
        {
            confidence += 0.05;
        }

        return Math.Round(Math.Clamp(confidence, 0.18, 0.99), 2);
    }

    private static double CalculateScoreConfidence(double top, double second, double normalizationTarget)
    {
        if (top <= 0)
        {
            return 0;
        }

        double dominance = top <= 0 ? 0 : Math.Clamp((top - second) / top, 0, 1);
        double support = Math.Clamp(top / normalizationTarget, 0, 1);
        return (dominance * 0.45) + (support * 0.55);
    }
}

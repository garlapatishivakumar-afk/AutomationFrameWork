using System.Text.RegularExpressions;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class AIResponseProcessor : IAIResponseProcessor
{
    public GeneratedScript Process(AIResponse response)
    {
        GeneratedScript script = new();
        if (!response.Success)
            return script;
        string content = response.Content;
        script.Feature = ExtractSection(content,"FEATURE","PAGEOBJECT");
        script.PageObjects = ExtractSection(content,"PAGEOBJECT","STEPDEFINITION");
        script.PageMethods = ExtractSection(content,"PAGEMETHODS","STEPDEFINITIONS");
        script.StepDefinitions = ExtractSection(content,"STEPDEFINITION","TEST");
        return script;
    }
    private static string ExtractSection(string content,string start,string? end)
    {
        if (string.IsNullOrWhiteSpace(content))
            return string.Empty;
        string pattern;
        if (end == null)
            pattern = $"{start}(.*)";
        else
            pattern = $"{start}(.*?){end}";
        Match match = Regex.Match(content,pattern,RegexOptions.Singleline | RegexOptions.IgnoreCase);
        if (!match.Success)
            return string.Empty;
        return match.Groups[1].Value.Trim();
    }
}
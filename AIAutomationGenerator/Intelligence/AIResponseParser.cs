using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class AIResponseParser : IAIResponseParser
{
    public AIResponseModel Parse(string response)
    {
        var model = new AIResponseModel();
        if (string.IsNullOrWhiteSpace(response))
        {
            model.IsMalformed = true;
            return model;
        }

        var sections = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Feature File"] = string.Empty,
            ["Page Objects"] = string.Empty,
            ["Methods"] = string.Empty,
            ["Step Definitions"] = string.Empty,
            ["Utilities"] = string.Empty,
            ["Validation Messages"] = string.Empty
        };

        var lines = response.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
        string? currentSection = null;

        foreach (var line in lines)
        {
            foreach (var section in sections.Keys)
            {
                if (line.StartsWith(section + ":", StringComparison.OrdinalIgnoreCase))
                {
                    currentSection = section;
                    break;
                }
            }

            if (currentSection is null)
            {
                continue;
            }

            // sections[currentSection] = sections[currentSection] + line + Environment.NewLine;
            if (!line.StartsWith(currentSection + ":"))
            {
                sections[currentSection] += line + Environment.NewLine;
            }
        }

        model.FeatureFile = sections["Feature File"].Trim();
        model.PageObjects = sections["Page Objects"].Trim();
        model.Methods = sections["Methods"].Trim();
        model.StepDefinitions = sections["Step Definitions"].Trim();
        model.Utilities = sections["Utilities"].Trim();
        model.ValidationMessages = sections["Validation Messages"].Trim();

        model.IsMalformed = string.IsNullOrWhiteSpace(model.FeatureFile) &&
            string.IsNullOrWhiteSpace(model.PageObjects) &&
            string.IsNullOrWhiteSpace(model.Methods) &&
            string.IsNullOrWhiteSpace(model.StepDefinitions) &&
            string.IsNullOrWhiteSpace(model.Utilities);

        return model;
    }
}

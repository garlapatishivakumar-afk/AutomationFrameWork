namespace AIAutomationGenerator.Interfaces;
using System.Collections.Generic;
public interface IPromptTemplateService
{
    string Load(string templateName);

    string Render(
        string templateName,
        Dictionary<string, string> values);
}
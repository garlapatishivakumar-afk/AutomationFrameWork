using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IScriptValidator
{
    ValidationResult Validate(string content);
    string AutoFix(string content);
}

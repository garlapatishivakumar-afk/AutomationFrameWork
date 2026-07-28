using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IUtilityParser
{
    IEnumerable<UtilityModel> Parse(string filePath);
}
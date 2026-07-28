using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface ILocatorParser
{
    IEnumerable<LocatorModel> Parse(string filePath);
}
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IMethodParser
{
    IEnumerable<MethodModel> Parse(string filePath);
}
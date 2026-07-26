using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IFeatureParser
{
    FeatureModel Parse(string filePath);
}
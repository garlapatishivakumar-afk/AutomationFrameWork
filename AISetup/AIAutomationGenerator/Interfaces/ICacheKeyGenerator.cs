namespace AIAutomationGenerator.Interfaces;

public interface ICacheKeyGenerator
{
    string Generate(string prompt);
}

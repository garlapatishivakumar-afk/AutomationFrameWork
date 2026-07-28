using AIAutomationGenerator.Interfaces;

namespace AIAutomationGenerator.Shared;

public class ConsoleLogger : ILogger
{
    public void LogInformation(string message)
    {
        Console.WriteLine(message);
    }

    public void LogError(string message, Exception exception)
    {
        Console.Error.WriteLine($"{message} {exception.Message}");
    }
}
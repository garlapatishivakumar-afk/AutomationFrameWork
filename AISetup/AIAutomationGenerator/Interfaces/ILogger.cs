namespace AIAutomationGenerator.Interfaces;

public interface ILogger
{
    void LogInformation(string message);

    void LogError(string message, Exception exception);
}
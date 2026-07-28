namespace AIAutomationGenerator.Interfaces;

public interface IAIHealthCheckService
{
    Task<bool> CheckAsync();
}

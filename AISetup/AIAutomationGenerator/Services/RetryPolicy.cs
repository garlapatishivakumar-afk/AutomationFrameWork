using System.Net;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public class RetryPolicy : IRetryPolicy
{
    private const int MaxRetries = 3;

    public async Task<AIResponse> ExecuteAsync(
        Func<Task<AIResponse>> operation)
    {
        for (int attempt = 1; attempt <= MaxRetries; attempt++)
        {
            try
            {
                return await operation();
            }
            catch (Exception ex) when (attempt < MaxRetries && IsTransient(ex))
            {
                int delay =
                    (int)Math.Pow(2, attempt) * 1000;

                await Task.Delay(delay);
            }
            catch (Exception ex)
            {
                return new AIResponse
                {
                    Success = false,
                    ErrorMessage = ex.ToString()
                };
            }
        }

        return new AIResponse
        {
            Success = false,
            ErrorMessage = "Retry policy exhausted."
        };
    }

    private static bool IsTransient(Exception exception)
    {
        if (exception is TaskCanceledException)
        {
            return true;
        }

        if (exception is HttpRequestException httpRequestException)
        {
            if (httpRequestException.StatusCode == null)
            {
                return true;
            }

            return (int)httpRequestException.StatusCode >= 500 ||
                   httpRequestException.StatusCode == HttpStatusCode.TooManyRequests;
        }

        return false;
    }
}
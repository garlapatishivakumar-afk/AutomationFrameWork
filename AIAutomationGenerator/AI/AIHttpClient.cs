using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class AIHttpClient : IAIClient
{
    private readonly HttpClient httpClient;
    private readonly IAIRequestSerializerFactory serializerFactory;
    private readonly IAIResponseDeserializerFactory deserializerFactory;
    private readonly IRetryPolicy retryPolicy;
    private readonly IAIMetricsService metricsService;
    private readonly IAIResponseCache responseCache;
    private readonly ICacheKeyGenerator cacheKeyGenerator;
    private readonly ITokenUsageCalculator usageCalculator;

    public AIHttpClient(
        HttpClient httpClient,
        IAIRequestSerializerFactory serializerFactory,
        IAIResponseDeserializerFactory deserializerFactory,
        IRetryPolicy retryPolicy,
        IAIMetricsService metricsService,
        IAIResponseCache responseCache,
        ICacheKeyGenerator cacheKeyGenerator,
        ITokenUsageCalculator usageCalculator)
    {
        this.httpClient = httpClient;
        this.serializerFactory = serializerFactory;
        this.deserializerFactory = deserializerFactory;
        this.retryPolicy = retryPolicy;
        this.metricsService = metricsService;
        this.responseCache = responseCache;
        this.cacheKeyGenerator = cacheKeyGenerator;
        this.usageCalculator = usageCalculator;
    }

    public async Task<AIResponse> SendAsync(
        AIConfiguration configuration,
        AIRequest request)
    {
        Stopwatch stopwatch = Stopwatch.StartNew();

        if (string.IsNullOrWhiteSpace(configuration.ApiKey))
        {
            AIResponse apiKeyResponse = new()
            {
                Success = false,
                ErrorMessage = "AI Provider API key not configured."
            };

            stopwatch.Stop();
            RecordMetrics(configuration, apiKeyResponse, stopwatch.Elapsed);
            return apiKeyResponse;
        }

        IAIRequestSerializer serializer =
            serializerFactory.Create(configuration);

        string json = serializer.Serialize(
            configuration,
            request);

        string cacheKey =
            cacheKeyGenerator.Generate(request.Prompt);

        if (responseCache.TryGet(cacheKey, out AIResponse cached))
        {
            return cached;
        }

        httpClient.Timeout = configuration.Timeout;

        AIResponse aiResponse = await retryPolicy.ExecuteAsync(async () =>
        {
            string requestUrl = configuration.BaseUrl;

            using HttpRequestMessage httpRequest = new(
                HttpMethod.Post,
                requestUrl);

            switch (configuration.Provider?.Trim())
            {
                case "OpenAI":
                    httpRequest.Headers.Authorization = new AuthenticationHeaderValue(
                        "Bearer",
                        configuration.ApiKey);
                    break;

                case "AzureOpenAI":
                    httpRequest.Headers.TryAddWithoutValidation(
                        "api-key",
                        configuration.ApiKey);
                    break;

                case "Gemini":
                    requestUrl = AppendGeminiApiKey(requestUrl, configuration.ApiKey);
                    httpRequest.RequestUri = new Uri(requestUrl);
                    break;

                default:
                    httpRequest.Headers.Authorization = new AuthenticationHeaderValue(
                        "Bearer",
                        configuration.ApiKey);
                    break;
            }

            httpRequest.Content = new StringContent(
                json,
                Encoding.UTF8,
                "application/json");

            HttpResponseMessage response =
                await httpClient.SendAsync(httpRequest);

            string content =
                await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                if ((int)response.StatusCode >= 500 ||
                    response.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    throw new HttpRequestException(
                        content,
                        null,
                        response.StatusCode);
                }

                return new AIResponse
                {
                    Success = false,
                    ErrorMessage = content
                };
            }

            IAIResponseDeserializer deserializer =
                deserializerFactory.Create(configuration);

            AIResponse result = deserializer.Deserialize(content);
            result.Usage = usageCalculator.Calculate(
                configuration,
                request.Prompt,
                result.Content);

            return result;
        });

        stopwatch.Stop();
        RecordMetrics(configuration, aiResponse, stopwatch.Elapsed);

        if (aiResponse.Success)
        {
            responseCache.Store(
                cacheKey,
                aiResponse);
        }

        return aiResponse;
    }

    private void RecordMetrics(
        AIConfiguration configuration,
        AIResponse result,
        TimeSpan duration)
    {
        AIMetrics metrics = new()
        {
            Timestamp = DateTime.UtcNow,
            Provider = configuration.Provider ?? string.Empty,
            Model = configuration.Model ?? string.Empty,
            Success = result.Success,
            Duration = duration,
            PromptTokens = result.Usage.PromptTokens,
            CompletionTokens = result.Usage.CompletionTokens,
            TotalTokens = result.Usage.TotalTokens,
            EstimatedCost = result.Usage.EstimatedCost,
            ErrorMessage = result.ErrorMessage
        };

        metricsService.Record(metrics);
    }

    private static string AppendGeminiApiKey(string baseUrl, string apiKey)
    {
        if (baseUrl.Contains("key=", StringComparison.OrdinalIgnoreCase))
        {
            return baseUrl;
        }

        string separator = baseUrl.Contains('?') ? "&" : "?";
        return $"{baseUrl}{separator}key={Uri.EscapeDataString(apiKey)}";
    }
}
using System.Net.Http.Headers;
using System.Text;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class OpenAIClient : IAIClient
{
    private readonly HttpClient httpClient;
    private readonly IAIRequestSerializer serializer;
    private readonly IAIResponseDeserializer deserializer;

    public OpenAIClient(
        HttpClient httpClient,
        IAIRequestSerializer serializer,
        IAIResponseDeserializer deserializer)
    {
        this.httpClient = httpClient;
        this.serializer = serializer;
        this.deserializer = deserializer;
    }

    public async Task<AIResponse> SendAsync(
        AIConfiguration configuration,
        AIRequest request)
    {
        if (string.IsNullOrWhiteSpace(configuration.ApiKey))
        {
            return new AIResponse
            {
                Success = false,
                ErrorMessage = "OpenAI API Key not configured."
            };
        }

        string json = serializer.Serialize(
            configuration,
            request);

        using HttpRequestMessage httpRequest = new(
            HttpMethod.Post,
            configuration.BaseUrl);

        httpRequest.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            configuration.ApiKey);

        httpRequest.Content = new StringContent(
            json,
            Encoding.UTF8,
            "application/json");

        httpClient.Timeout = configuration.Timeout;

        try
        {
            HttpResponseMessage response =
                await httpClient.SendAsync(httpRequest);

            string content =
                await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                return new AIResponse
                {
                    Success = false,
                    ErrorMessage = content
                };
            }

            return deserializer.Deserialize(content);
        }
        catch (Exception ex)
        {
            return new AIResponse
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
using System.Text.Json;
using AIAutomationGenerator.AI.Contracts;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class OpenAIRequestSerializer : IAIRequestSerializer
{
    public string Serialize(
        AIConfiguration configuration,
        AIRequest request)
    {
        switch (configuration.Provider)
        {
            case "Gemini":
                return SerializeGemini(configuration, request);

            case "AzureOpenAI":
            case "OpenAI":
            default:
                return SerializeOpenAI(configuration, request);
        }
    }

    private static string SerializeOpenAI(
        AIConfiguration configuration,
        AIRequest request)
    {
        OpenAIChatRequest chatRequest = new()
        {
            Model = configuration.Model,
            Temperature = configuration.Temperature,
            MaxTokens = configuration.MaxTokens
        };

        chatRequest.Messages.Add(new OpenAIMessage
        {
            Role = "user",
            Content = request.Prompt
        });

        return JsonSerializer.Serialize(
            chatRequest,
            new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
    }

    private static string SerializeGemini(
        AIConfiguration configuration,
        AIRequest request)
    {
        var geminiRequest = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new
                        {
                            text = request.Prompt
                        }
                    }
                }
            },
            generationConfig = new
            {
                temperature = configuration.Temperature,
                maxOutputTokens = configuration.MaxTokens
            }
        };

        return JsonSerializer.Serialize(
            geminiRequest,
            new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
    }
}
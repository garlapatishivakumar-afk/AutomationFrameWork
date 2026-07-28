using System.Text.Json;
using AIAutomationGenerator.AI.Contracts;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class AzureOpenAIRequestSerializer : IAIRequestSerializer
{
    public string Serialize(
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
}

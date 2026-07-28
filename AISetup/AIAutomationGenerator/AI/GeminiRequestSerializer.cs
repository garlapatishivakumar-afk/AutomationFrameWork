using System.Text.Json;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class GeminiRequestSerializer : IAIRequestSerializer
{
    public string Serialize(
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

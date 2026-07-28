using System.Text.Json;
using AIAutomationGenerator.AI.Contracts;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class AzureOpenAIResponseDeserializer : IAIResponseDeserializer
{
    public AIResponse Deserialize(string response)
    {
        OpenAIChatResponse? chatResponse =
            JsonSerializer.Deserialize<OpenAIChatResponse>(response);

        if (chatResponse == null ||
            chatResponse.Choices.Count == 0)
        {
            return new AIResponse
            {
                Success = false,
                ErrorMessage = "Invalid Azure OpenAI response."
            };
        }

        return new AIResponse
        {
            Success = true,
            Content = chatResponse.Choices[0].Message.Content
        };
    }
}

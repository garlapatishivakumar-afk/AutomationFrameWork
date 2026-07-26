using System.Text.Json;
using AIAutomationGenerator.AI.Contracts;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class OpenAIResponseDeserializer : IAIResponseDeserializer
{
    public AIResponse Deserialize(string response)
    {
        OpenAIChatResponse? chatResponse =
            JsonSerializer.Deserialize<OpenAIChatResponse>(response);

        if (chatResponse == null || chatResponse.Choices.Count == 0)
        {
            return new AIResponse
            {
                Success = false,
                ErrorMessage = "Invalid AI response."
            };
        }

        return new AIResponse
        {
            Success = true,
            Response = chatResponse.Choices[0].Message.Content
        };
    }
}

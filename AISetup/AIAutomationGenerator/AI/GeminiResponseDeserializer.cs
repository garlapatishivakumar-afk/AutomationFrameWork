using System.Text.Json;
using AIAutomationGenerator.AI.Contracts;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class GeminiResponseDeserializer : IAIResponseDeserializer
{
    public AIResponse Deserialize(string response)
    {
        GeminiChatResponse? gemini =
            JsonSerializer.Deserialize<GeminiChatResponse>(response);

        if (gemini == null ||
            gemini.Candidates.Count == 0 ||
            gemini.Candidates[0].Content.Parts.Count == 0)
        {
            return new AIResponse
            {
                Success = false,
                ErrorMessage = "Invalid Gemini response."
            };
        }

        return new AIResponse
        {
            Success = true,
            Content = gemini.Candidates[0].Content.Parts[0].Text
        };
    }
}

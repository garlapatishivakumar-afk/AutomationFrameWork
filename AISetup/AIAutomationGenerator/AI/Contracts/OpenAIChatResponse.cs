using System.Text.Json.Serialization;

namespace AIAutomationGenerator.AI.Contracts;

public class OpenAIChatResponse
{
    [JsonPropertyName("model")]
    public string Model { get; set; } = string.Empty;

    [JsonPropertyName("usage")]
    public OpenAIUsage? Usage { get; set; }

    [JsonPropertyName("choices")]
    public List<OpenAIChoice> Choices { get; set; } = new();
}

public class OpenAIUsage
{
    [JsonPropertyName("prompt_tokens")]
    public int PromptTokens { get; set; }

    [JsonPropertyName("completion_tokens")]
    public int CompletionTokens { get; set; }

    [JsonPropertyName("total_tokens")]
    public int TotalTokens { get; set; }
}
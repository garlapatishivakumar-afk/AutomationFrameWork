namespace AIAutomationGenerator.AI.Contracts;

public class OpenAIChatRequest
{
    public string Model { get; set; } = string.Empty;

    public List<OpenAIMessage> Messages { get; set; } = new();

    public double Temperature { get; set; }

    public int MaxTokens { get; set; }
}
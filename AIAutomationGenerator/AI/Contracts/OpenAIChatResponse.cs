namespace AIAutomationGenerator.AI.Contracts;

public class OpenAIChatResponse
{
    public List<OpenAIChoice> Choices { get; set; } = new();
}
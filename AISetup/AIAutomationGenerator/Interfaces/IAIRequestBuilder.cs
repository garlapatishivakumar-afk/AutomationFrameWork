using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIRequestBuilder
{
    AIRequest Build(
        PromptContext context,
        PromptModel prompt,
        List<BusinessFlowModel> flows);
}
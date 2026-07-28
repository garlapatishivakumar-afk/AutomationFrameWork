using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class AIRequestBuilder : IAIRequestBuilder
{
    public AIRequest Build(
        PromptContext context,
        PromptModel prompt,
        List<BusinessFlowModel> flows)
    {
        return new AIRequest
        {
            Prompt = prompt.Prompt,
            Context = context,
            BusinessFlows = flows
        };
    }
}
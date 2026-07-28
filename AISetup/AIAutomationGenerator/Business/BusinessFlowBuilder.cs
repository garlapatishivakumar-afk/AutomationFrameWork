using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Business;

public class BusinessFlowBuilder : IBusinessFlowBuilder
{
    private readonly IBusinessFlowDetector flowDetector;

    public BusinessFlowBuilder(IBusinessFlowDetector flowDetector)
    {
        this.flowDetector = flowDetector;
    }

    public List<BusinessFlowModel> Build(List<RecordingActionModel> actions)
    {
        List<BusinessFlowModel> flows = [];
        if (actions.Count == 0)
            return flows;

        BusinessFlowDetectionResult detection = flowDetector.Detect(actions);
        BusinessFlowModel flow = new();
        flow.Name = detection.FlowName;
        flow.Verb = detection.Verb;
        flow.Noun = detection.Noun;
        flow.Confidence = detection.Confidence;
        flow.Evidence.AddRange(detection.Evidence);
        flow.Actions.AddRange(actions);
        flows.Add(flow);
        return flows;
    }
}
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IBusinessFlowDetector
{
    BusinessFlowDetectionResult Detect(List<RecordingActionModel> actions);
}

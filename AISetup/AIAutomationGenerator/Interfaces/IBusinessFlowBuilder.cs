using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IBusinessFlowBuilder
{
    List<BusinessFlowModel> Build(List<RecordingActionModel> actions);
}
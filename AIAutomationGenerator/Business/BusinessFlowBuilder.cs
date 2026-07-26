using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Business;

public class BusinessFlowBuilder : IBusinessFlowBuilder
{
    public List<BusinessFlowModel> Build(List<RecordingActionModel> actions)
    {
        List<BusinessFlowModel> flows = [];
        if (actions.Count == 0)
            return flows;
        BusinessFlowModel flow = new();
        flow.Name = DetectFlowName(actions);
        flow.Actions.AddRange(actions);
        flows.Add(flow);
        return flows;
    }
    private static string DetectFlowName(List<RecordingActionModel> actions)
{
    string content = string.Join(" ",
        actions.Select(a => a.Target)).ToLower();
    if (content.Contains("login"))
        return "Login";
    if (content.Contains("search"))
        return "Search";
    if (content.Contains("create"))
        return "Create";
    if (content.Contains("approve"))
        return "Approve";
    if (content.Contains("delete"))
        return "Delete";
    if (content.Contains("logout"))
        return "Logout";
    return "Generated Flow";
}
}
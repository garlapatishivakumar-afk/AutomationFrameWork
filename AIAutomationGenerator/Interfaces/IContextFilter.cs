using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IContextFilter
{
    ContextModel Filter(
        ContextModel context,
        List<BusinessFlowModel> flows);
}
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface ILocatorReuseEngine
{
    List<LocatorModel> FindReusableLocators(
        ContextModel context,
        List<BusinessFlowModel> flows);
}
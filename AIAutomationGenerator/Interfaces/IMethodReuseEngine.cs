using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IMethodReuseEngine
{
    List<MethodModel> FindReusableMethods(
        ContextModel context,
        List<BusinessFlowModel> flows);
}
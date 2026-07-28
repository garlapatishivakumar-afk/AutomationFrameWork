using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IContextRankingService
{
    ContextPackage RankContext(ContextPackage package, ContextRequest request);
}

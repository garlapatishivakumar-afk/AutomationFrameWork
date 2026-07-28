using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IArtifactNamingService
{
    ArtifactNamingResult Generate(BusinessFlowDetectionResult flow);
}

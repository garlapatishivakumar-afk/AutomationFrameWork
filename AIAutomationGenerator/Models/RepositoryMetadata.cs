namespace AIAutomationGenerator.Models;

public class RepositoryMetadata
{
    public List<MethodModel> Methods { get; set; } = new();
    public List<LocatorModel> Locators { get; set; } = new();
    public List<FeatureModel> Features { get; set; } = new();
    public List<StepDefinitionModel> Steps { get; set; } = new();
    public List<UtilityModel> Utilities { get; set; } = new();
    public List<RelationshipModel> Relationships { get; set; } = new();
}
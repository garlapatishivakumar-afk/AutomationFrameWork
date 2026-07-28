namespace AIAutomationGenerator.Models;

public class RepositoryKnowledge
{
    public List<FeatureKnowledge> Features { get; set; } = [];
    public List<PageKnowledge> Pages { get; set; } = [];
    public List<UtilityKnowledge> Utilities { get; set; } = [];
    public List<BusinessFlowModel> BusinessFlows { get; set; } = [];
    public List<RelationshipModel> Relationships { get; set; } = [];
}
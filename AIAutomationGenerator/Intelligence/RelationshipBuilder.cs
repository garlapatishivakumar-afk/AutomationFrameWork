using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class RelationshipBuilder : IRelationshipBuilder
{
    public void Build(RepositoryMetadata metadata)
    {
        BuildFeatureStepRelationships(metadata);

        BuildStepMethodRelationships(metadata);

        BuildMethodLocatorRelationships(metadata);

        BuildMethodUtilityRelationships(metadata);
    }

    private static void BuildFeatureStepRelationships(RepositoryMetadata metadata)
    {
        foreach (FeatureModel feature in metadata.Features)
        {
            foreach (string step in feature.UsedStepDefinitions)
            {
                StepDefinitionModel? stepDefinition =
                    metadata.Steps.FirstOrDefault(x =>
                        x.StepText.Equals(step, StringComparison.OrdinalIgnoreCase));

                if (stepDefinition == null)
                    continue;

                metadata.Relationships.Add(new RelationshipModel
                {
                    Source = feature.Name,
                    Target = stepDefinition.MethodName,
                    RelationshipType = "FeatureUsesStep"
                });
            }
        }
    }

    private static void BuildStepMethodRelationships(RepositoryMetadata metadata)
    {
        foreach (StepDefinitionModel step in metadata.Steps)
        {
            MethodModel? method =
                metadata.Methods.FirstOrDefault(x =>
                    x.Name.Equals(step.MethodName, StringComparison.OrdinalIgnoreCase));

            if (method == null)
                continue;

            metadata.Relationships.Add(new RelationshipModel
            {
                Source = step.MethodName,
                Target = method.Name,
                RelationshipType = "StepCallsMethod"
            });
        }
    }

    private static void BuildMethodLocatorRelationships(RepositoryMetadata metadata)
    {
        foreach (MethodModel method in metadata.Methods)
        {
            foreach (string calledMethod in method.CalledMethods)
            {
                LocatorModel? locator =
                    metadata.Locators.FirstOrDefault(x =>
                        calledMethod.Contains(x.Name));

                if (locator == null)
                    continue;

                metadata.Relationships.Add(new RelationshipModel
                {
                    Source = method.Name,
                    Target = locator.Name,
                    RelationshipType = "MethodUsesLocator"
                });
            }
        }
    }

    private static void BuildMethodUtilityRelationships(RepositoryMetadata metadata)
    {
        foreach (MethodModel method in metadata.Methods)
        {
            foreach (string calledMethod in method.CalledMethods)
            {
                UtilityModel? utility =
                    metadata.Utilities.FirstOrDefault(x =>
                        x.Methods.Contains(calledMethod));

                if (utility == null)
                    continue;

                metadata.Relationships.Add(new RelationshipModel
                {
                    Source = method.Name,
                    Target = utility.Name,
                    RelationshipType = "MethodUsesUtility"
                });
            }
        }
    }
}
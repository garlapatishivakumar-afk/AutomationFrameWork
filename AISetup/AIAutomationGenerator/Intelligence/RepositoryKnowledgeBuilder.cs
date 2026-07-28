using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class RepositoryKnowledgeBuilder : IRepositoryKnowledgeBuilder
{
    public RepositoryKnowledge Build(RepositoryMetadata metadata)
    {
        var knowledge = new RepositoryKnowledge();

        foreach (var feature in metadata.Features)
        {
            knowledge.Features.Add(new FeatureKnowledge
            {
                Name = feature.Name,
                BusinessArea = string.Empty,
                Confidence = 1.0
            });
        }

        foreach (var method in metadata.Methods)
        {
            var page = knowledge.Pages.FirstOrDefault(x => x.Name == method.ClassName);

            if (page == null)
            {
                page = new PageKnowledge
                {
                    Name = method.ClassName
                };

                knowledge.Pages.Add(page);
            }

            page.Methods.Add(method.Name);
        }

        foreach (var locator in metadata.Locators)
        {
            var page = knowledge.Pages.FirstOrDefault(x => x.Name == locator.PageName);

            if (page == null)
            {
                page = new PageKnowledge
                {
                    Name = locator.PageName
                };

                knowledge.Pages.Add(page);
            }

            page.Locators.Add(locator.Name);
        }

        foreach (var utility in metadata.Utilities)
        {
            knowledge.Utilities.Add(new UtilityKnowledge
            {
                Name = utility.Name
            });
        }

        knowledge.Relationships.AddRange(metadata.Relationships);

        return knowledge;
    }
}

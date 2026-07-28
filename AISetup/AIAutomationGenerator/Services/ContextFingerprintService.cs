using System.Security.Cryptography;
using System.Text;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public class ContextFingerprintService : IContextFingerprintService
{
    public string GenerateFingerprint(
        RepositoryMetadata metadata,
        string repositoryPath,
        string generatorVersion)
    {
        StringBuilder builder = new();
        builder.AppendLine($"RepositoryPath:{repositoryPath}");
        builder.AppendLine($"GeneratorVersion:{generatorVersion}");

        foreach (FeatureModel feature in metadata.Features
            .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase))
        {
            builder.AppendLine($"Feature|{feature.Name}|{feature.FilePath}|{feature.BusinessArea}");
        }

        foreach (MethodModel method in metadata.Methods
            .OrderBy(x => x.ClassName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase))
        {
            builder.AppendLine($"Method|{method.ClassName}|{method.Name}|{method.FilePath}");
        }

        foreach (LocatorModel locator in metadata.Locators
            .OrderBy(x => x.PageName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase))
        {
            builder.AppendLine($"PageObject|{locator.PageName}|{locator.Name}|{locator.FilePath}");
        }

        foreach (StepDefinitionModel step in metadata.Steps
            .OrderBy(x => x.MethodName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(x => x.StepText, StringComparer.OrdinalIgnoreCase))
        {
            builder.AppendLine($"StepDefinition|{step.MethodName}|{step.StepText}|{step.FilePath}");
        }

        foreach (UtilityModel utility in metadata.Utilities
            .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase))
        {
            string methods = string.Join(",", utility.Methods.OrderBy(x => x, StringComparer.OrdinalIgnoreCase));
            builder.AppendLine($"Utility|{utility.Name}|{utility.FilePath}|{methods}");
        }

        byte[] bytes = Encoding.UTF8.GetBytes(builder.ToString());
        byte[] hash = SHA256.HashData(bytes);

        return Convert.ToHexString(hash);
    }
}

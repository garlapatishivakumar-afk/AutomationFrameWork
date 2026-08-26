using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Optimization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace AIAutomationGenerator.FrameworkScanner;

public class StepDefinitionParser : IStepDefinitionParser
{
    private static readonly IFileContentCacheService FileCache = new FileContentCacheService();

    public IEnumerable<StepDefinitionModel> Parse(string filePath)
    {
        List<StepDefinitionModel> steps = new();

        UsageTelemetryService.Current?.IncrementParserInvocations();
        string source = FileCache.ReadAllText(filePath);

        SyntaxTree tree = CSharpSyntaxTree.ParseText(source);

        CompilationUnitSyntax root = tree.GetCompilationUnitRoot();

        var methods = root.DescendantNodes().OfType<MethodDeclarationSyntax>();

        foreach (var method in methods)
        {
            foreach (var attributeList in method.AttributeLists)
            {
                foreach (var attribute in attributeList.Attributes)
                {
                    string attributeName = attribute.Name.ToString();

                    if (attributeName == "Given" ||
                        attributeName == "When" ||
                        attributeName == "Then")
                    {
                        StepDefinitionModel step = new();

                        step.MethodName = method.Identifier.Text;
                        step.FilePath = filePath;

                        if (attribute.ArgumentList != null)
                        {
                            step.StepText = attribute.ArgumentList.Arguments.FirstOrDefault()?.ToString().Trim('"') ?? string.Empty;
                        }

                        steps.Add(step);
                    }
                }
            }
        }

        return steps;
    }
}
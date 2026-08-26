using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Optimization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace AIAutomationGenerator.FrameworkScanner;

public class UtilityParser : IUtilityParser
{
    private static readonly IFileContentCacheService FileCache = new FileContentCacheService();

    public IEnumerable<UtilityModel> Parse(string filePath)
    {
        List<UtilityModel> utilities = new();

        UsageTelemetryService.Current?.IncrementParserInvocations();
        string source = FileCache.ReadAllText(filePath);

        SyntaxTree tree = CSharpSyntaxTree.ParseText(source);

        CompilationUnitSyntax root = tree.GetCompilationUnitRoot();

        foreach (var classNode in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
        {
            UtilityModel utility = new();

            utility.Name = classNode.Identifier.Text;
            utility.FilePath = filePath;

            foreach (var method in classNode.Members.OfType<MethodDeclarationSyntax>())
            {
                utility.Methods.Add(method.Identifier.Text);
            }

            utilities.Add(utility);
        }

        return utilities;
    }
}
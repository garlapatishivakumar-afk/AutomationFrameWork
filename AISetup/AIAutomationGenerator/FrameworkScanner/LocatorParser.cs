using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace AIAutomationGenerator.FrameworkScanner;

public class LocatorParser : ILocatorParser
{
    public IEnumerable<LocatorModel> Parse(string filePath)
    {
        List<LocatorModel> locators = new();

        string source = File.ReadAllText(filePath);

        SyntaxTree tree = CSharpSyntaxTree.ParseText(source);

        CompilationUnitSyntax root = tree.GetCompilationUnitRoot();

        string pageName = Path.GetFileNameWithoutExtension(filePath);

        var properties = root.DescendantNodes().OfType<PropertyDeclarationSyntax>();

        foreach (var property in properties)
        {
            LocatorModel locator = new();

            locator.Name = property.Identifier.Text;
            locator.PageName = pageName;
            locator.FilePath = filePath;
            locator.LocatorType = property.Type.ToString();
            locator.Selector = property.ExpressionBody?.Expression.ToString() ?? string.Empty;

            locators.Add(locator);
        }

        return locators;
    }
}
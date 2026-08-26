using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Optimization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace AIAutomationGenerator.FrameworkScanner;

public class MethodParser : IMethodParser
{
    private static readonly IFileContentCacheService FileCache = new FileContentCacheService();

    public IEnumerable<MethodModel> Parse(string filePath)
    {
        List<MethodModel> methods = new();

        UsageTelemetryService.Current?.IncrementParserInvocations();
        string source = FileCache.ReadAllText(filePath);

        SyntaxTree tree = CSharpSyntaxTree.ParseText(source);

        CompilationUnitSyntax root = tree.GetCompilationUnitRoot();

        string namespaceName =
            root.DescendantNodes()
                .OfType<NamespaceDeclarationSyntax>()
                .FirstOrDefault()?.Name.ToString()
            ?? string.Empty;

        var classes = root.DescendantNodes()
                          .OfType<ClassDeclarationSyntax>();

        foreach (var classNode in classes)
        {
            string className = classNode.Identifier.Text;

            var methodNodes = classNode.Members
                                       .OfType<MethodDeclarationSyntax>();

            foreach (var methodNode in methodNodes)
            {
                MethodModel model = new();

                model.Name = methodNode.Identifier.Text;
                model.ClassName = className;
                model.Namespace = namespaceName;
                model.ReturnType = methodNode.ReturnType.ToString();
                model.IsAsync = methodNode.Modifiers.Any(m => m.Text == "async");
                model.FilePath = filePath;

                foreach (var parameter in methodNode.ParameterList.Parameters)
                {
                    model.Parameters.Add(new ParameterModel
                    {
                        Name = parameter.Identifier.Text,
                        Type = parameter.Type?.ToString() ?? string.Empty,
                        IsOptional = parameter.Default != null,
                        DefaultValue = parameter.Default?.Value.ToString() ?? string.Empty
                    });
                }

                var xml = methodNode.GetLeadingTrivia()
                                .Select(t => t.ToString())
                                .Where(t => t.TrimStart().StartsWith("///"));

                model.XmlSummary = string.Join(Environment.NewLine, xml);

                foreach (var attributeList in methodNode.AttributeLists)
                {
                    foreach (var attribute in attributeList.Attributes)
                    {
                        model.Tags.Add(attribute.Name.ToString());
                    }
                }

                var invocations = methodNode.DescendantNodes()
                                            .OfType<InvocationExpressionSyntax>();

                foreach (var invocation in invocations)
                {
                    model.CalledMethods.Add(invocation.Expression.ToString());
                }

                methods.Add(model);
            }
        }

        return methods;
    }
}
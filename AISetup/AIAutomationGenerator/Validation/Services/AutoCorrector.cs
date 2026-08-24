using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Validation.Services;

namespace AIAutomationGenerator.Validation.Services
{
    /// <summary>
    /// Automatically corrects common errors by generating correction plans.
    /// Fixable errors: missing usings, namespace errors, simple type mismatches.
    /// Plans feed back into generators for component regeneration.
    /// </summary>
    public class AutoCorrector
    {
        /// <summary>
        /// Plan corrections for diagnosed errors.
        /// Returns list of corrections (empty if nothing is fixable).
        /// </summary>
        public List<CorrectionPlan> PlanCorrections(List<ErrorDiagnosis> diagnoses)
        {
            var plans = new List<CorrectionPlan>();

            if (diagnoses == null || diagnoses.Count == 0)
                return plans;

            foreach (var diagnosis in diagnoses.Where(d => d.IsAutoFixable))
            {
                var plan = CreateCorrectionPlan(diagnosis);
                if (plan != null)
                {
                    plans.Add(plan);
                }
            }

            return plans;
        }

        /// <summary>
        /// Create a specific correction plan based on error type.
        /// </summary>
        private CorrectionPlan CreateCorrectionPlan(ErrorDiagnosis diagnosis)
        {
            return diagnosis.Category switch
            {
                "MissingType" => PlanMissingTypeCorrection(diagnosis),
                "NamespaceError" => PlanNamespaceCorrection(diagnosis),
                "TypeMismatch" => PlanTypeMismatchCorrection(diagnosis),
                "NullReferenceAssertion" => PlanNullReferenceCorrection(diagnosis),
                "EmptyCollection" => PlanEmptyCollectionCorrection(diagnosis),
                _ => null
            };
        }

        /// <summary>
        /// Plan correction for missing type (e.g., missing using directive).
        /// Extract type name from error and suggest using directive.
        /// </summary>
        private CorrectionPlan PlanMissingTypeCorrection(ErrorDiagnosis diagnosis)
        {
            // Error message: "The type or namespace name 'IPage' could not be found"
            // Extract type name
            var typeMatch = System.Text.RegularExpressions.Regex.Match(
                diagnosis.Message,
                @"'(\w+)'",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            if (!typeMatch.Success)
                return null;

            var typeName = typeMatch.Groups[1].Value;

            // Suggest using directives based on type name
            var suggestedUsings = InferUsingDirectives(typeName);

            return new CorrectionPlan
            {
                CorrectionType = CorrectionType.AddUsing,
                Component = diagnosis.RelatedComponent,
                ComponentType = ExtractComponentType(diagnosis.FilePath),
                Details = new AddUsingCorrection
                {
                    MissingTypeName = typeName,
                    SuggestedUsings = suggestedUsings,
                    FilePath = diagnosis.FilePath,
                    Line = diagnosis.Line
                },
                Priority = 1,
                Description = $"Add using directive for {typeName}"
            };
        }

        /// <summary>
        /// Plan correction for namespace errors.
        /// </summary>
        private CorrectionPlan PlanNamespaceCorrection(ErrorDiagnosis diagnosis)
        {
            // Error message: "Expected namespace or type declaration"
            // Likely caused by wrong namespace in file

            var suggestedNamespace = InferNamespaceFromPath(diagnosis.FilePath);

            return new CorrectionPlan
            {
                CorrectionType = CorrectionType.FixNamespace,
                Component = diagnosis.RelatedComponent,
                ComponentType = ExtractComponentType(diagnosis.FilePath),
                Details = new FixNamespaceCorrection
                {
                    FilePath = diagnosis.FilePath,
                    SuggestedNamespace = suggestedNamespace,
                    Line = diagnosis.Line
                },
                Priority = 1,
                Description = $"Fix namespace to {suggestedNamespace}"
            };
        }

        /// <summary>
        /// Plan correction for type mismatches (e.g., missing cast).
        /// </summary>
        private CorrectionPlan PlanTypeMismatchCorrection(ErrorDiagnosis diagnosis)
        {
            // Error message: "Cannot convert type 'X' to 'Y'"
            var typeMatch = System.Text.RegularExpressions.Regex.Match(
                diagnosis.Message,
                @"'(\w+)'\s+to\s+'(\w+)'",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            if (!typeMatch.Success)
                return null;

            var fromType = typeMatch.Groups[1].Value;
            var toType = typeMatch.Groups[2].Value;

            return new CorrectionPlan
            {
                CorrectionType = CorrectionType.FixTypeConversion,
                Component = diagnosis.RelatedComponent,
                ComponentType = ExtractComponentType(diagnosis.FilePath),
                Details = new TypeConversionCorrection
                {
                    FromType = fromType,
                    ToType = toType,
                    FilePath = diagnosis.FilePath,
                    Line = diagnosis.Line
                },
                Priority = 2,
                Description = $"Add conversion from {fromType} to {toType}"
            };
        }

        /// <summary>
        /// Plan correction for null reference assertions (likely initialization issue).
        /// </summary>
        private CorrectionPlan PlanNullReferenceCorrection(ErrorDiagnosis diagnosis)
        {
            return new CorrectionPlan
            {
                CorrectionType = CorrectionType.FixNullReference,
                Component = diagnosis.RelatedComponent,
                ComponentType = diagnosis.TestMethod,
                Details = new NullReferenceCorrection
                {
                    TestName = diagnosis.TestName,
                    TestMethod = diagnosis.TestMethod,
                    Suggestion = "Add null checks or verify initialization order"
                },
                Priority = 2,
                Description = "Fix null reference in test"
            };
        }

        /// <summary>
        /// Plan correction for empty collection assertions.
        /// </summary>
        private CorrectionPlan PlanEmptyCollectionCorrection(ErrorDiagnosis diagnosis)
        {
            return new CorrectionPlan
            {
                CorrectionType = CorrectionType.FixEmptyCollection,
                Component = diagnosis.RelatedComponent,
                ComponentType = diagnosis.TestMethod,
                Details = new EmptyCollectionCorrection
                {
                    TestName = diagnosis.TestName,
                    TestMethod = diagnosis.TestMethod,
                    Suggestion = "Verify test data setup or collection population logic"
                },
                Priority = 2,
                Description = "Fix empty collection in test"
            };
        }

        /// <summary>
        /// Infer using directives for a missing type.
        /// </summary>
        private List<string> InferUsingDirectives(string typeName)
        {
            var usings = new List<string>();

            // Common type to using mappings
            var typeUsings = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase)
            {
                { "IPage", new List<string> { "using Microsoft.Playwright;" } },
                { "ILocator", new List<string> { "using Microsoft.Playwright;" } },
                { "IFrame", new List<string> { "using Microsoft.Playwright;" } },
                { "AriaRole", new List<string> { "using Microsoft.Playwright;" } },
                { "Task", new List<string> { "using System.Threading.Tasks;" } },
                { "IAsyncEnumerable", new List<string> { "using System.Collections.Generic;" } },
                { "List", new List<string> { "using System.Collections.Generic;" } },
                { "Dictionary", new List<string> { "using System.Collections.Generic;" } },
                { "When", new List<string> { "using Reqnroll;" } },
                { "Then", new List<string> { "using Reqnroll;" } },
                { "Given", new List<string> { "using Reqnroll;" } },
                { "ScenarioContext", new List<string> { "using Reqnroll;" } }
            };

            if (typeUsings.TryGetValue(typeName, out var typeUsingsList))
            {
                usings.AddRange(typeUsingsList);
            }
            else
            {
                // Default: suggest System namespace
                usings.Add("using System;");
            }

            return usings;
        }

        /// <summary>
        /// Infer namespace from file path.
        /// E.g., PageElements/ViewDashboardObjects.cs → AutomationFrameWork.PageElements
        /// </summary>
        private string InferNamespaceFromPath(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                return "AutomationFrameWork";

            var pathParts = filePath.Replace('\\', '/').Split('/');

            if (pathParts.Length == 0)
                return "AutomationFrameWork";

            var folder = pathParts.Length > 1 ? pathParts[pathParts.Length - 2] : "AutomationFrameWork";

            return $"AutomationFrameWork.{folder}";
        }

        /// <summary>
        /// Extract component type from file path.
        /// E.g., PageElements/ViewDashboardObjects.cs → PageElement
        /// </summary>
        private string ExtractComponentType(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                return "Unknown";

            if (filePath.Contains("PageElements", StringComparison.OrdinalIgnoreCase))
                return "PageElement";
            if (filePath.Contains("PageActions", StringComparison.OrdinalIgnoreCase))
                return "PageAction";
            if (filePath.Contains("StepDefinitions", StringComparison.OrdinalIgnoreCase))
                return "StepDefinition";
            if (filePath.Contains("Features", StringComparison.OrdinalIgnoreCase))
                return "Feature";

            return "Unknown";
        }
    }

    public class CorrectionPlan
    {
        public CorrectionType CorrectionType { get; set; }
        public string Component { get; set; }              // Which component to regenerate
        public string ComponentType { get; set; }         // PageElement, PageAction, etc.
        public object Details { get; set; }               // Correction-specific details
        public int Priority { get; set; }                 // 1 = critical, 2 = important, 3 = nice-to-have
        public string Description { get; set; }           // Human-readable description
    }

    public enum CorrectionType
    {
        AddUsing,
        FixNamespace,
        FixTypeConversion,
        FixNullReference,
        FixEmptyCollection,
        RegenerateComponent,
        Other
    }

    // Correction-specific detail classes
    public class AddUsingCorrection
    {
        public string MissingTypeName { get; set; }
        public List<string> SuggestedUsings { get; set; }
        public string FilePath { get; set; }
        public int Line { get; set; }
    }

    public class FixNamespaceCorrection
    {
        public string FilePath { get; set; }
        public string SuggestedNamespace { get; set; }
        public int Line { get; set; }
    }

    public class TypeConversionCorrection
    {
        public string FromType { get; set; }
        public string ToType { get; set; }
        public string FilePath { get; set; }
        public int Line { get; set; }
    }

    public class NullReferenceCorrection
    {
        public string TestName { get; set; }
        public string TestMethod { get; set; }
        public string Suggestion { get; set; }
    }

    public class EmptyCollectionCorrection
    {
        public string TestName { get; set; }
        public string TestMethod { get; set; }
        public string Suggestion { get; set; }
    }
}

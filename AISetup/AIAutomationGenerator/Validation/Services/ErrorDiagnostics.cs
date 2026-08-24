using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using AIAutomationGenerator.Validation.Services;

namespace AIAutomationGenerator.Validation.Services
{
    /// <summary>
    /// Analyzes compilation and test failures to diagnose root causes.
    /// Categorizes errors (missing using, wrong type, etc.) for auto-correction.
    /// Maps errors back to generators that produced them.
    /// </summary>
    public class ErrorDiagnostics
    {
        /// <summary>
        /// Diagnose compilation errors to determine root causes and fixability.
        /// </summary>
        public List<ErrorDiagnosis> DiagnoseCompilationErrors(List<CompilationError> errors, List<GeneratedFile> generatedFiles = null)
        {
            var diagnoses = new List<ErrorDiagnosis>();

            if (errors == null || errors.Count == 0)
                return diagnoses;

            foreach (var error in errors)
            {
                var diagnosis = new ErrorDiagnosis
                {
                    ErrorType = ErrorType.CompilationError,
                    FilePath = error.FilePath,
                    Line = error.Line,
                    Message = error.Message,
                    ErrorCode = error.ErrorCode,
                    OriginalError = error
                };

                // Categorize the error
                CategorizeCompilationError(diagnosis, error);

                // Determine if fixable
                diagnosis.IsAutoFixable = IsErrorAutoFixable(diagnosis);

                // Find related generated component
                if (generatedFiles != null)
                {
                    diagnosis.RelatedComponent = FindRelatedComponent(error.FilePath, generatedFiles);
                }

                diagnoses.Add(diagnosis);
            }

            return diagnoses;
        }

        /// <summary>
        /// Diagnose test failures to understand what went wrong.
        /// </summary>
        public List<ErrorDiagnosis> DiagnoseTestFailures(List<TestFailure> failures, List<GeneratedFile> generatedFiles = null)
        {
            var diagnoses = new List<ErrorDiagnosis>();

            if (failures == null || failures.Count == 0)
                return diagnoses;

            foreach (var failure in failures)
            {
                var diagnosis = new ErrorDiagnosis
                {
                    ErrorType = ErrorType.TestFailure,
                    TestName = failure.TestName,
                    TestMethod = failure.TestMethod,
                    Message = failure.AssertionError,
                    StackTrace = failure.StackTrace,
                    OriginalFailure = failure
                };

                // Categorize the failure
                CategorizeTestFailure(diagnosis, failure);

                // Determine if fixable
                diagnosis.IsAutoFixable = IsTestFailureAutoFixable(diagnosis);

                // Find related component (from stack trace)
                if (generatedFiles != null && !string.IsNullOrEmpty(failure.StackTrace))
                {
                    diagnosis.RelatedComponent = FindRelatedComponentFromStackTrace(failure.StackTrace, generatedFiles);
                }

                diagnoses.Add(diagnosis);
            }

            return diagnoses;
        }

        /// <summary>
        /// Categorize compilation error to determine root cause.
        /// </summary>
        private void CategorizeCompilationError(ErrorDiagnosis diagnosis, CompilationError error)
        {
            var message = error.Message?.ToLower() ?? "";

            if (message.Contains("is not defined") || message.Contains("cannot find type") || message.Contains("could not be found"))
            {
                diagnosis.Category = "MissingType";
                diagnosis.Suggestion = "Add using directive or fully qualify the type name";
            }
            else if (message.Contains("does not contain a definition") || message.Contains("is not accessible"))
            {
                diagnosis.Category = "MissingMember";
                diagnosis.Suggestion = "Check method/property name or accessibility (public/private)";
            }
            else if (message.Contains("namespace") && message.Contains("expected"))
            {
                diagnosis.Category = "NamespaceError";
                diagnosis.Suggestion = "Verify namespace declaration matches file location";
            }
            else if (message.Contains("syntax error") || message.Contains("unexpected token"))
            {
                diagnosis.Category = "SyntaxError";
                diagnosis.Suggestion = "Check for missing braces, semicolons, or invalid syntax";
            }
            else if (message.Contains("operator") && message.Contains("cannot"))
            {
                diagnosis.Category = "OperatorMismatch";
                diagnosis.Suggestion = "Check types are compatible with the operator";
            }
            else if (message.Contains("parameter") || message.Contains("argument"))
            {
                diagnosis.Category = "ParameterMismatch";
                diagnosis.Suggestion = "Check method signature matches call site (types, count)";
            }
            else if (message.Contains("return") && message.Contains("expected"))
            {
                diagnosis.Category = "ReturnTypeMismatch";
                diagnosis.Suggestion = "Ensure return type matches method signature";
            }
            else if (message.Contains("cannot convert"))
            {
                diagnosis.Category = "TypeMismatch";
                diagnosis.Suggestion = "Check type conversions or casting";
            }
            else
            {
                diagnosis.Category = "Other";
                diagnosis.Suggestion = "Review error message carefully; may require manual intervention";
            }
        }

        /// <summary>
        /// Categorize test failure to understand assertion violation.
        /// </summary>
        private void CategorizeTestFailure(ErrorDiagnosis diagnosis, TestFailure failure)
        {
            var message = failure.AssertionError?.ToLower() ?? "";

            if (message.Contains("notequals") || message.Contains("not equal"))
            {
                diagnosis.Category = "AssertionValueMismatch";
                diagnosis.Suggestion = "Check expected vs actual values";
            }
            else if (message.Contains("notnull") || message.Contains("is null"))
            {
                diagnosis.Category = "NullReferenceAssertion";
                diagnosis.Suggestion = "Component is null; check initialization or null propagation";
            }
            else if (message.Contains("true"))
            {
                diagnosis.Category = "AssertionFalse";
                diagnosis.Suggestion = "Expected True but got False; check condition logic";
            }
            else if (message.Contains("false"))
            {
                diagnosis.Category = "AssertionTrue";
                diagnosis.Suggestion = "Expected False but got True; check condition logic";
            }
            else if (message.Contains("notempty"))
            {
                diagnosis.Category = "EmptyCollection";
                diagnosis.Suggestion = "Collection is empty; check if data was populated";
            }
            else if (message.Contains("count") || message.Contains("length"))
            {
                diagnosis.Category = "CountMismatch";
                diagnosis.Suggestion = "Collection size doesn't match expected; check data generation";
            }
            else
            {
                diagnosis.Category = "OtherAssertion";
                diagnosis.Suggestion = "Review test logic and expected behavior";
            }
        }

        /// <summary>
        /// Determine if an error can be automatically fixed.
        /// </summary>
        private bool IsErrorAutoFixable(ErrorDiagnosis diagnosis)
        {
            return diagnosis.Category switch
            {
                "MissingType" => true,        // Can add using
                "MissingMember" => false,     // Usually requires manual inspection
                "NamespaceError" => true,     // Can fix namespace
                "SyntaxError" => false,       // Too risky to auto-fix
                "OperatorMismatch" => false,  // Requires domain knowledge
                "ParameterMismatch" => false, // Needs signature review
                "ReturnTypeMismatch" => false,// Needs signature review
                "TypeMismatch" => true,       // Can add type conversion/cast
                _ => false
            };
        }

        /// <summary>
        /// Determine if test failure can be automatically fixed.
        /// </summary>
        private bool IsTestFailureAutoFixable(ErrorDiagnosis diagnosis)
        {
            return diagnosis.Category switch
            {
                "NullReferenceAssertion" => true,  // Often due to missing initialization
                "EmptyCollection" => true,         // Often due to missing data setup
                _ => false                         // Other assertions require logic review
            };
        }

        /// <summary>
        /// Find which generated file/component is related to an error.
        /// </summary>
        private string FindRelatedComponent(string errorFilePath, List<GeneratedFile> generatedFiles)
        {
            if (string.IsNullOrEmpty(errorFilePath) || generatedFiles == null || generatedFiles.Count == 0)
                return null;

            // Normalize path
            var normalizedErrorPath = errorFilePath.Replace('\\', '/').ToLower();

            // Look for exact match
            var match = generatedFiles.FirstOrDefault(f =>
                f.FilePath?.Replace('\\', '/').ToLower() == normalizedErrorPath);

            if (match != null)
                return match.ComponentName ?? match.ComponentType;

            // Look for file name match (in case of relative path)
            var errorFileName = System.IO.Path.GetFileName(errorFilePath).ToLower();
            match = generatedFiles.FirstOrDefault(f =>
                System.IO.Path.GetFileName(f.FilePath)?.ToLower() == errorFileName);

            return match?.ComponentName ?? match?.ComponentType;
        }

        /// <summary>
        /// Find related component from test stack trace.
        /// </summary>
        private string FindRelatedComponentFromStackTrace(string stackTrace, List<GeneratedFile> generatedFiles)
        {
            if (string.IsNullOrEmpty(stackTrace) || generatedFiles == null || generatedFiles.Count == 0)
                return null;

            // Extract file references from stack trace
            var filePattern = new Regex(@"(\S+\.cs):line\s+(\d+)", RegexOptions.IgnoreCase);
            var matches = filePattern.Matches(stackTrace);

            foreach (Match match in matches)
            {
                var fileName = match.Groups[1].Value;
                var relatedFile = FindRelatedComponent(fileName, generatedFiles);
                if (relatedFile != null)
                    return relatedFile;
            }

            return null;
        }
    }

    public class ErrorDiagnosis
    {
        public ErrorType ErrorType { get; set; }
        public string Category { get; set; }           // Category of error
        public string Message { get; set; }           // Original error/assertion message
        public string ErrorCode { get; set; }         // For compilation errors (CS0001, etc.)
        public string FilePath { get; set; }          // File path for compilation errors
        public int Line { get; set; }                 // Line number
        public string TestName { get; set; }          // For test failures
        public string TestMethod { get; set; }        // For test failures
        public string StackTrace { get; set; }        // For test failures
        public string Suggestion { get; set; }        // How to fix it
        public bool IsAutoFixable { get; set; }       // Can auto-corrector fix it?
        public string RelatedComponent { get; set; }  // Which generated component is affected
        public object OriginalError { get; set; }     // Reference to original error/failure object
        public object OriginalFailure { get; set; }   // Reference to original test failure object
    }

    public enum ErrorType
    {
        CompilationError,
        TestFailure,
        Architecture,
        Integration
    }
}

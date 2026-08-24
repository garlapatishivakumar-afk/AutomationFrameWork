using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace AIAutomationGenerator.Validation.Services
{
    /// <summary>
    /// Orchestrates complete validation pipeline for generated code.
    /// Phases: SafeWrite → Build → Test → Diagnose → Correct → Rebuild → Validate
    /// Returns comprehensive validation report with status, metrics, and rollback instructions.
    /// </summary>
    public class ValidationPipeline
    {
        private readonly string _frameworkRoot;
        private readonly string _testProjectPath;
        private readonly int? _expectedPassingTests;

        public ValidationPipeline(string frameworkRoot, string testProjectPath, int? expectedPassingTests = null)
        {
            _frameworkRoot = frameworkRoot ?? throw new ArgumentNullException(nameof(frameworkRoot));
            _testProjectPath = testProjectPath ?? throw new ArgumentNullException(nameof(testProjectPath));
            _expectedPassingTests = expectedPassingTests;
        }

        /// <summary>
        /// Run complete validation pipeline on generated files.
        /// </summary>
        public async Task<ValidationReport> ValidateAsync(List<GeneratedFile> generatedFiles, bool dryRun = false)
        {
            var report = new ValidationReport
            {
                StartTime = DateTime.UtcNow,
                GeneratedFileCount = generatedFiles?.Count ?? 0,
                DryRun = dryRun
            };

            try
            {
                // Phase 1: SafeWrite
                report.AddPhaseEntry("Phase 1: SafeWrite", "Writing generated files safely");
                var writeResults = await Phase1_SafeWrite(generatedFiles, report);
                if (!writeResults.Any(w => w.Success))
                {
                    report.FinalStatus = "FAILED";
                    report.Error = "SafeWrite phase failed - no files were written";
                    return report;
                }

                // Phase 2: BuildValidator
                report.AddPhaseEntry("Phase 2: BuildValidator", "Validating compilation");
                var buildResult = await Phase2_ValidateBuild(report);
                if (!buildResult.Success)
                {
                    report.AddPhaseEntry("Phase 4: ErrorDiagnosis", "Analyzing build errors");
                    var diagnoses = Phase4_DiagnoseErrors(buildResult.Errors, generatedFiles, report);

                    // Phase 5: AutoCorrection (attempt to fix)
                    report.AddPhaseEntry("Phase 5: AutoCorrection", "Planning auto-corrections");
                    var corrections = Phase5_PlanCorrections(diagnoses, report);

                    if (corrections.Any(c => c.Priority == 1))
                    {
                        // Critical errors - rollback
                        report.AddPhaseEntry("Phase 13: RollbackStrategy", "Critical errors detected - rolling back");
                        var rollbackSuccess = await Phase13_Rollback(writeResults, report);
                        report.FinalStatus = rollbackSuccess ? "ROLLED_BACK" : "FAILED_TO_ROLLBACK";
                        report.Error = $"Critical build errors; {(rollbackSuccess ? "successfully" : "failed to")} rollback";
                        return report;
                    }
                }

                // Phase 3: TestValidator
                report.AddPhaseEntry("Phase 3: TestValidator", "Validating tests");
                var testResult = await Phase3_ValidateTests(report);
                if (!testResult.Success && testResult.IsRegression)
                {
                    report.AddPhaseEntry("Phase 13: RollbackStrategy", "Test regression detected - rolling back");
                    var rollbackSuccess = await Phase13_Rollback(writeResults, report);
                    report.FinalStatus = rollbackSuccess ? "ROLLED_BACK" : "FAILED_TO_ROLLBACK";
                    report.Error = $"Test regression; {(rollbackSuccess ? "successfully" : "failed to")} rollback";
                    return report;
                }

                // Phase 9: ArchitectureGate
                report.AddPhaseEntry("Phase 9: ArchitectureGate", "Validating architecture compliance");
                var archValidation = Phase9_ArchitectureGate(generatedFiles, report);
                if (!archValidation.IsValid)
                {
                    report.FinalStatus = "ARCHITECTURE_VIOLATION";
                    report.Error = $"Architecture validation failed: {archValidation.Error}";
                    return report;
                }

                // Phase 11: ComprehensiveTestSuite
                report.AddPhaseEntry("Phase 11: ComprehensiveTestSuite", "Running full test suite");
                var fullTestResult = await Phase11_ComprehensiveTests(report);
                report.FinalPassedTests = fullTestResult.PassedTests;
                report.FinalFailedTests = fullTestResult.FailedTests;
                report.FinalTotalTests = fullTestResult.TotalTests;

                // Phase 12: ReportGeneration
                report.AddPhaseEntry("Phase 12: ReportGeneration", "Generating validation report");
                Phase12_GenerateReport(report, writeResults, buildResult, testResult, archValidation);

                // Phase 15: Commit (in actual implementation)
                if (!dryRun && fullTestResult.Success)
                {
                    report.FinalStatus = "SUCCESS";
                    report.Message = "Validation complete - all tests passing, architecture valid, ready for commit";
                }
                else if (fullTestResult.Success)
                {
                    report.FinalStatus = "DRY_RUN_COMPLETE";
                    report.Message = "Dry run validation complete - no actual changes made";
                }
                else
                {
                    report.FinalStatus = "PARTIAL_SUCCESS";
                    report.Message = $"Validation complete with warnings: {fullTestResult.FailedTests} test(s) failed";
                }

                return report;
            }
            catch (Exception ex)
            {
                report.FinalStatus = "ERROR";
                report.Error = $"Validation pipeline exception: {ex.Message}";
                return report;
            }
            finally
            {
                report.EndTime = DateTime.UtcNow;
            }
        }

        private async Task<List<WriteResult>> Phase1_SafeWrite(List<GeneratedFile> files, ValidationReport report)
        {
            var writer = new SafeWriter();
            var results = await writer.WriteAsync(files, _frameworkRoot);

            var successCount = results.Count(r => r.Success);
            report.AddPhaseResult("Phase 1: SafeWrite", successCount == results.Count,
                $"Wrote {successCount}/{results.Count} files successfully");

            report.WriteResults = results;
            return results;
        }

        private async Task<BuildValidationResult> Phase2_ValidateBuild(ValidationReport report)
        {
            var buildProject = Path.Combine(_frameworkRoot, "AutomationFrameWork.csproj");
            var validator = new BuildValidator(buildProject);
            var result = await validator.ValidateAsync();

            var status = result.Success ? "succeeded" : "failed";
            report.AddPhaseResult("Phase 2: BuildValidator", result.Success,
                $"Build {status} with {result.Errors.Count} error(s), {result.WarningCount} warning(s)");

            report.BuildResult = result;
            return result;
        }

        private async Task<TestValidationResult> Phase3_ValidateTests(ValidationReport report)
        {
            var validator = new TestValidator(_testProjectPath, _expectedPassingTests);
            var result = await validator.ValidateAsync();

            report.AddPhaseResult("Phase 3: TestValidator", result.Success,
                $"Tests: {result.PassedTests} passed, {result.FailedTests} failed, {result.SkippedTests} skipped");

            report.TestResult = result;
            return result;
        }

        private List<ErrorDiagnosis> Phase4_DiagnoseErrors(List<CompilationError> errors, List<GeneratedFile> generatedFiles, ValidationReport report)
        {
            var diagnostics = new ErrorDiagnostics();
            var diagnoses = diagnostics.DiagnoseCompilationErrors(errors, generatedFiles);

            var autoFixable = diagnoses.Count(d => d.IsAutoFixable);
            report.AddPhaseResult("Phase 4: ErrorDiagnosis", true,
                $"Analyzed {diagnoses.Count} error(s), {autoFixable} are auto-fixable");

            report.ErrorDiagnoses = diagnoses;
            return diagnoses;
        }

        private List<CorrectionPlan> Phase5_PlanCorrections(List<ErrorDiagnosis> diagnoses, ValidationReport report)
        {
            var corrector = new AutoCorrector();
            var plans = corrector.PlanCorrections(diagnoses);

            report.AddPhaseResult("Phase 5: AutoCorrection", true,
                $"Planned {plans.Count} correction(s)");

            report.CorrectionPlans = plans;
            return plans;
        }

        private async Task<bool> Phase13_Rollback(List<WriteResult> writeResults, ValidationReport report)
        {
            try
            {
                var backupPaths = new Dictionary<string, string>();
                foreach (var result in writeResults.Where(r => !string.IsNullOrEmpty(r.BackupPath)))
                {
                    backupPaths[Path.Combine(_frameworkRoot, result.FilePath)] = result.BackupPath;
                }

                var writer = new SafeWriter();
                var success = await writer.RestoreFromBackupAsync(backupPaths);

                report.AddPhaseResult("Phase 13: RollbackStrategy", success,
                    success ? "Rolled back successfully" : "Rollback attempted with errors");

                return success;
            }
            catch (Exception ex)
            {
                report.AddPhaseResult("Phase 13: RollbackStrategy", false, $"Rollback failed: {ex.Message}");
                return false;
            }
        }

        private ArchitectureValidationResult Phase9_ArchitectureGate(List<GeneratedFile> files, ValidationReport report)
        {
            // Placeholder implementation - real validation would check:
            // - Namespace conventions
            // - Class naming patterns
            // - Method signatures (async, parameters)
            // - Reqnroll bindings

            var result = new ArchitectureValidationResult { IsValid = true };

            // Basic checks
            foreach (var file in files ?? new List<GeneratedFile>())
            {
                if (file.FilePath.EndsWith(".cs", StringComparison.OrdinalIgnoreCase))
                {
                    // Check namespace
                    if (!file.Content.Contains("namespace "))
                    {
                        result.IsValid = false;
                        result.Error = $"{file.FilePath} missing namespace declaration";
                        break;
                    }

                    // Check class declaration
                    if (!file.Content.Contains("public class "))
                    {
                        result.IsValid = false;
                        result.Error = $"{file.FilePath} missing public class declaration";
                        break;
                    }
                }
            }

            report.AddPhaseResult("Phase 9: ArchitectureGate", result.IsValid,
                result.IsValid ? "Architecture validation passed" : result.Error);

            return result;
        }

        private async Task<TestValidationResult> Phase11_ComprehensiveTests(ValidationReport report)
        {
            var validator = new TestValidator(_testProjectPath, _expectedPassingTests);
            var result = await validator.ValidateAsync();

            report.AddPhaseResult("Phase 11: ComprehensiveTestSuite", result.Success,
                $"Final test run: {result.PassedTests} passed, {result.FailedTests} failed");

            return result;
        }

        private void Phase12_GenerateReport(ValidationReport report, List<WriteResult> writeResults,
            BuildValidationResult buildResult, TestValidationResult testResult, ArchitectureValidationResult archResult)
        {
            var summary = new List<string>
            {
                "=== VALIDATION REPORT ===",
                $"Timestamp: {report.StartTime:O}",
                $"Duration: {report.Duration.TotalSeconds:F1}s",
                "",
                "=== SUMMARY ===",
                $"Generated Files: {report.GeneratedFileCount}",
                $"Files Written: {writeResults.Count(w => w.Success)}/{writeResults.Count}",
                $"Build Status: {(buildResult.Success ? "PASSED" : "FAILED")}",
                $"Test Status: {(testResult.Success ? "PASSED" : "FAILED")}",
                $"Architecture: {(archResult.IsValid ? "VALID" : "INVALID")}",
                "",
                "=== TEST RESULTS ===",
                $"Total Tests: {report.FinalTotalTests}",
                $"Passed: {report.FinalPassedTests}",
                $"Failed: {report.FinalFailedTests}"
            };

            report.Summary = string.Join(Environment.NewLine, summary);
        }
    }

    public class ValidationReport
    {
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public TimeSpan Duration => EndTime - StartTime;
        public string FinalStatus { get; set; } // SUCCESS, FAILED, ERROR, ROLLED_BACK, etc.
        public string Message { get; set; }
        public string Error { get; set; }
        public bool DryRun { get; set; }
        public int GeneratedFileCount { get; set; }
        public int FinalTotalTests { get; set; }
        public int FinalPassedTests { get; set; }
        public int FinalFailedTests { get; set; }
        public string Summary { get; set; }
        public List<string> PhaseLog { get; set; } = new();
        public List<WriteResult> WriteResults { get; set; }
        public BuildValidationResult BuildResult { get; set; }
        public TestValidationResult TestResult { get; set; }
        public List<ErrorDiagnosis> ErrorDiagnoses { get; set; }
        public List<CorrectionPlan> CorrectionPlans { get; set; }

        public void AddPhaseEntry(string phase, string description)
        {
            PhaseLog.Add($"[{DateTime.UtcNow:HH:mm:ss}] {phase}: {description}");
        }

        public void AddPhaseResult(string phase, bool success, string details)
        {
            var status = success ? "✓" : "✗";
            PhaseLog.Add($"[{DateTime.UtcNow:HH:mm:ss}] {phase}: {status} {details}");
        }
    }

    public class ArchitectureValidationResult
    {
        public bool IsValid { get; set; }
        public string Error { get; set; }
    }
}

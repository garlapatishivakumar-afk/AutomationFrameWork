using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Diagnostics;
using System.Text;
using System.Threading.Tasks;
using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Implementation;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Intelligence.Services;
using AIAutomationGenerator.Knowledge;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Optimization;
using AIAutomationGenerator.Orchestration;
using AIAutomationGenerator.Planning;
using AIAutomationGenerator.Safety;
using AIAutomationGenerator.Validation.Services;
using ValidationBuildValidationResult = AIAutomationGenerator.Validation.Services.BuildValidationResult;
using ValidationTestValidationResult = AIAutomationGenerator.Validation.Services.TestValidationResult;

namespace AIAutomationGenerator.Agent
{
    /// <summary>
    /// V7.0 P3 — 16-stage master orchestrator for the complete autonomous pipeline.
    ///
    /// Stages:
    ///   S1  ParseRecording
    ///   S2  SelectContext
    ///   S3  RetrieveKnowledge
    ///   S4  EnrichEvidence
    ///   S5  CreateEngineeringPlan
    ///   S6  GenerateImplementation
    ///   S7  ApplyChanges
    ///   S8  Build
    ///   S9  ExecuteTests
    ///   S10 AnalyzeFailures
    ///   S11 SelfHeal
    ///   S12 Retest
    ///   S13 FrameworkProtection
    ///   S14 CollectUsage
    ///   S15 GenerateEvidence
    ///   S16 Acceptance
    ///
    /// HUMAN_REVIEW_REQUIRED stops the pipeline; framework protection is mandatory.
    /// </summary>
    public class V7MasterOrchestrator
    {
        private readonly string _repositoryRoot;
        private readonly CodegenParser _parser;
        private readonly RelevantContextSelector _contextSelector;
        private readonly FrameworkIndexService _frameworkIndexService;
        private readonly RepositorySnapshotService _snapshotService;
        private readonly ProtectedFilePolicy _protectedFilePolicy;
        private readonly FailureClassifier _failureClassifier;
        private readonly ErrorDiagnostics _errorDiagnostics;
        private readonly AutoCorrector _autoCorrector;
        private readonly KnowledgeIndexService _indexSvc;
        private readonly KnowledgeRetrievalService _retrievalSvc;
        private readonly KnowledgeEnrichmentService _enrichmentSvc;
        private readonly EngineeringPlanner _planner;
        private readonly ImplementationEngine _implEngine;
        private readonly string _buildProjectPath;
        private readonly string _testProjectPath;
        private readonly int _maxSelfHealRetries;
        private readonly IDeterministicRetrievalService _deterministicRetrieval;
        private readonly IAiContextPackBuilder _contextPackBuilder;
        private readonly IAiEscalationPolicy _aiEscalationPolicy;
        private readonly IValidationImpactAnalyzer _validationImpactAnalyzer;

        public V7MasterOrchestrator(
            string repositoryRoot,
            string? buildProjectPath = null,
            string? testProjectPath = null,
            int maxSelfHealRetries = 2)
        {
            _repositoryRoot  = repositoryRoot ?? throw new ArgumentNullException(nameof(repositoryRoot));
            _parser          = new CodegenParser();
            _contextSelector = new RelevantContextSelector();
            _frameworkIndexService = new FrameworkIndexService(repositoryRoot, new SolutionScanner());
            _snapshotService = new RepositorySnapshotService();
            _protectedFilePolicy = new ProtectedFilePolicy(repositoryRoot);
            _failureClassifier = new FailureClassifier();
            _errorDiagnostics = new ErrorDiagnostics();
            _autoCorrector = new AutoCorrector();
            _indexSvc        = new KnowledgeIndexService();
            _retrievalSvc    = new KnowledgeRetrievalService();
            _enrichmentSvc   = new KnowledgeEnrichmentService();
            _planner         = new EngineeringPlanner(_protectedFilePolicy);
            _implEngine      = new ImplementationEngine(_protectedFilePolicy);
            _buildProjectPath = buildProjectPath ?? Path.Combine(_repositoryRoot, "AutomationFrameWork.csproj");
            _testProjectPath = testProjectPath ?? Path.Combine(_repositoryRoot, "AISetup", "AIAutomationGenerator.Tests", "AIAutomationGenerator.Tests.csproj");
            _maxSelfHealRetries = Math.Max(0, maxSelfHealRetries);
            _deterministicRetrieval = new DeterministicRetrievalService();
            _contextPackBuilder = new AiContextPackBuilder();
            _aiEscalationPolicy = new AiEscalationPolicy();
            _validationImpactAnalyzer = new ValidationImpactAnalyzer();
        }

        public async Task<V7ExecutionResult> RunAsync(string recordingFilePath, bool dryRun = true)
            => await RunAsync(recordingFilePath, dryRun, humanApprovals: null);

        /// <summary>
        /// Runs the full pipeline. If humanApprovals are provided, they are applied after S5
        /// evaluation — S5 still flags ambiguities correctly; the approvals are a separate,
        /// auditable step that can unlock a HumanReviewRequired plan only when ALL flagged
        /// decisions are explicitly resolved.
        /// </summary>
        public async Task<V7ExecutionResult> RunAsync(
            string recordingFilePath,
            bool dryRun,
            IReadOnlyList<HumanApprovalRecord>? humanApprovals)
        {
            var telemetry = new UsageTelemetryService();
            using var telemetryScope = UsageTelemetryService.BeginScope(telemetry);

            var result = new V7ExecutionResult
            {
                RunId = Guid.NewGuid().ToString("N"),
                RecordingPath = recordingFilePath,
                StartedAt     = DateTime.UtcNow,
                DryRun        = dryRun
            };

            // ===== S1: ParseRecording =====
            var s1 = StartStage("S1:ParseRecording");
            CodegenParseResult parseResult = null;
            try
            {
                if (string.IsNullOrEmpty(recordingFilePath) || !File.Exists(recordingFilePath))
                {
                    EndStage(s1, false, null, $"Recording file not found: {recordingFilePath}",
                             humanReview: $"File not found: {recordingFilePath}");
                    result.AddStage(s1);
                    return Finalise(result, "HumanReviewRequired");
                }
                parseResult = _parser.ParseFile(recordingFilePath);
                result.ParsedActions = parseResult.Actions.ToList();
                if (parseResult.ActionCount == 0)
                {
                    EndStage(s1, false, null, "0 actions parsed",
                             humanReview: "Recording produced no actions.");
                    result.AddStage(s1);
                    return Finalise(result, "HumanReviewRequired");
                }
                EndStage(s1, true, $"{parseResult.ActionCount} actions parsed");
            }
            catch (Exception ex) { EndStage(s1, false, null, ex.Message, humanReview: ex.Message); }
            result.AddStage(s1);
            if (!s1.Succeeded) return Finalise(result, "HumanReviewRequired");

            // ===== S2: SelectContext =====
            var s2 = StartStage("S2:SelectContext");
            RepositoryKnowledgeModel fullRepository = null;
            RepositoryKnowledgeModel filteredRepo = null;
            ContextSelectionResult ctxResult = null;
            try
            {
                fullRepository = await _frameworkIndexService.GetIndexAsync(forceRebuild: false);
                result.RepositorySnapshot = _snapshotService.Create(_repositoryRoot, fullRepository, result.RunId);
                result.RepositorySnapshotHash = result.RepositorySnapshot.SnapshotHash;
                result.RepositoryFileCount = result.RepositorySnapshot.FileCount;

                ctxResult   = _contextSelector.SelectRelevantContext(fullRepository, parseResult.Actions);
                result.SelectedContextPages = ctxResult?.InferredPages?.ToList() ?? new List<string>();
                filteredRepo = ctxResult.FilteredIndex;
                EndStage(s2, true,
                    $"Context reduced by {ctxResult.Metrics.ReductionPercent}%");
            }
            catch (Exception ex) { EndStage(s2, false, null, ex.Message); }
            result.AddStage(s2);

            // ===== S3: RetrieveKnowledge =====
            var s3 = StartStage("S3:RetrieveKnowledge");
            KnowledgeRetrievalResult retrieval = null;
            try
            {
                var index  = _indexSvc.Build(filteredRepo);
                retrieval  = _retrievalSvc.Retrieve(
                    index, ctxResult.InferredPages, parseResult.Actions);

                if (retrieval.IsEmpty && HasKnowledgeCandidates(fullRepository))
                {
                    var fallbackIndex = _indexSvc.Build(fullRepository);
                    retrieval = _retrievalSvc.Retrieve(
                        fallbackIndex, ctxResult.InferredPages, parseResult.Actions);
                }

                var reranked = _deterministicRetrieval.RankCandidates(
                    retrieval.Items,
                    parseResult.Actions,
                    maxCandidates: 150,
                    out var deterministicConfidence);

                retrieval = new KnowledgeRetrievalResult
                {
                    Items = reranked,
                    Metrics = retrieval.Metrics
                };
                retrieval.Metrics.RetrievedItems = reranked.Count;
                retrieval.Metrics.CandidateItems = Math.Max(retrieval.Metrics.CandidateItems, reranked.Count);
                result.DeterministicRetrievalConfidence = deterministicConfidence;

                result.KnowledgeRetrievedCount = retrieval.Metrics.RetrievedItems;
                result.RetrievedEvidenceCount = retrieval.Items.Count;
                EndStage(s3, true,
                    $"{retrieval.Metrics.RetrievedItems} items retrieved (confidence={deterministicConfidence:F3})");
            }
            catch (Exception ex) { EndStage(s3, false, null, ex.Message); }
            result.AddStage(s3);

            // ===== S4: EnrichEvidence =====
            var s4 = StartStage("S4:EnrichEvidence");
            AutomationIntelligenceModel intelligence = null;
            try
            {
                var contextModel = BuildContextModel(filteredRepo);
                result.AiContextPack = _contextPackBuilder.BuildPack(
                    contextModel,
                    parseResult.Actions,
                    maxMethods: 20,
                    maxLocators: 20,
                    maxSteps: 10,
                    tokenBudgetChars: 12000);

                result.AiEscalationTriggered = _aiEscalationPolicy.ShouldEscalateToAi(
                    contextModel,
                    parseResult.Actions,
                    out var escalationReason);
                result.AiEscalationReason = escalationReason;

                intelligence = new AutomationIntelligenceModel
                {
                    AnalysisTimestamp   = DateTime.UtcNow.ToString("O"),
                    RepositoryRoot      = _repositoryRoot,
                    RepositoryKnowledge = filteredRepo,
                    ContextSelection    = ctxResult.Metrics,
                    RecordingIntelligence = new RecordingIntelligenceModel
                    {
                        Actions      = parseResult.Actions,
                        RelatedPages = ctxResult.InferredPages.ToList()
                    }
                };
                _enrichmentSvc.Enrich(intelligence, retrieval);
                result.EvidenceCount = intelligence.EvidenceCount;
                EndStage(s4, true,
                    $"{intelligence.EvidenceCount} evidence items attached; AI escalation={(result.AiEscalationTriggered ? "yes" : "no")}");
            }
            catch (Exception ex) { EndStage(s4, false, null, ex.Message); }
            result.AddStage(s4);

            // ===== S5: CreateEngineeringPlan =====
            var s5 = StartStage("S5:CreateEngineeringPlan");
            EngineeringPlan plan = null;
            try
            {
                plan = _planner.CreatePlan(intelligence, recordingFilePath);
                plan.ProtectedFiles = _protectedFilePolicy.GetProtectedPaths();
                foreach (var change in plan.PlannedFileChanges)
                {
                    change.IsProtected = _protectedFilePolicy.IsProtected(change.FilePath);
                    if (change.IsProtected)
                    {
                        change.ModificationType = FileModificationType.Protected;
                    }
                }

                result.ReuseCount         = plan.ReuseCount;
                result.ExtendCount        = plan.ExtendCount;
                result.CreateCount        = plan.CreateCount;
                result.HumanReviewCount   = plan.HumanReviewCount;
                UsageTelemetryService.Current?.IncrementReusedFiles(plan.ReuseCount);
                UsageTelemetryService.Current?.IncrementExtendedFiles(plan.ExtendCount);
                UsageTelemetryService.Current?.IncrementGeneratedFiles(plan.CreateCount);
                UsageTelemetryService.Current?.IncrementHumanReviewCount(plan.HumanReviewCount);
                result.EngineeringPlanSummary = $"R={plan.ReuseCount},E={plan.ExtendCount},C={plan.CreateCount},HR={plan.HumanReviewCount}";
                result.HumanReviewQuestions = plan.HumanReviewQuestions.ToList();
                EndStage(s5, plan.Status != PlanStatus.HumanReviewRequired,
                    $"Plan: R={plan.ReuseCount} E={plan.ExtendCount} C={plan.CreateCount} HR={plan.HumanReviewCount}",
                    plan.Status == PlanStatus.HumanReviewRequired ? "Plan requires human review" : null,
                    plan.Status == PlanStatus.HumanReviewRequired
                        ? string.Join("; ", plan.HumanReviewReasons) : null);
            }
            catch (Exception ex) { EndStage(s5, false, null, ex.Message); }
            result.AddStage(s5);

            // ===== S5.5: ApplyHumanApprovals (only when explicit approvals provided) =====
            // S5 safety gate remains unchanged — this step runs AFTER S5 has flagged ambiguities.
            // It only unlocks the plan if the caller has provided explicit human-approved resolutions
            // for ALL flagged decisions. If any HR decision remains unresolved, the gate still blocks.
            if (plan?.Status == PlanStatus.HumanReviewRequired &&
                humanApprovals != null && humanApprovals.Count > 0)
            {
                var approvalSvc = new HumanApprovalService();
                var approvalResult = approvalSvc.Apply(plan, humanApprovals);
                result.HumanApprovalResult = approvalResult;

                if (!approvalResult.AllApproved)
                {
                    // Some HR decisions still unresolved or some approvals rejected
                    return Finalise(result, "HumanReviewRequired");
                }
                // All HR decisions resolved — plan.Status is now Ready; continue to S6
            }
            else if (plan?.Status == PlanStatus.HumanReviewRequired)
            {
                return Finalise(result, "HumanReviewRequired");
            }

            // ===== S6+S7: GenerateImplementation + ApplyChanges =====
            var s6 = StartStage("S6:GenerateImplementation");
            var s7 = StartStage("S7:ApplyChanges");
            ImplementationExecutionRecord implRecord = null;
            try
            {
                implRecord = _implEngine.Execute(plan, applyFileSystemChanges: !dryRun);
                result.FilesModified          = implRecord.Changes.Count(c => c.Status == ChangeStatus.Applied);
                result.FrameworkModifications = implRecord.FrameworkModified ? 1 : 0;
                result.CorrectionsAttempted   = implRecord.CorrectionsAttempted;
                result.CorrectionsSucceeded   = implRecord.CorrectionsSucceeded;
                result.Rollbacks              = implRecord.Rollbacks;
                result.ImplementationChanges = implRecord.Changes.ToList();
                EndStage(s6, true, $"Implementation plan executed: {implRecord.FinalStatus}");
                EndStage(s7, implRecord.FinalStatus != ImplementationStatus.HumanReviewRequired,
                    $"Changes: {implRecord.Changes.Count}",
                    implRecord.FinalStatus == ImplementationStatus.HumanReviewRequired
                        ? "Changes require human review" : null,
                    implRecord.HumanReviewRequired);
            }
            catch (Exception ex)
            {
                EndStage(s6, false, null, ex.Message);
                EndStage(s7, false, null, ex.Message);
            }
            result.AddStage(s6);
            result.AddStage(s7);

            // ===== S8-S12: Build/Test/Analyze/SelfHeal/Retest =====
            if (dryRun)
            {
                foreach (var stageName in new[] { "S8:Build", "S9:ExecuteTests",
                    "S10:AnalyzeFailures", "S11:SelfHeal", "S12:Retest" })
                {
                    var sX = StartStage(stageName);
                    EndStage(sX, true, "Skipped in dry-run — live build/test not executed");
                    sX.Skipped = true;
                    result.AddStage(sX);
                }
            }
            else
            {
                var impactedProjects = _validationImpactAnalyzer.GetImpactedTestProjects(
                    plan?.PlannedFileChanges ?? new List<FilePlan>(),
                    _repositoryRoot);

                if (impactedProjects.Count == 0)
                {
                    foreach (var stageName in new[] { "S8:Build", "S9:ExecuteTests", "S10:AnalyzeFailures", "S11:SelfHeal", "S12:Retest" })
                    {
                        var skippedStage = StartStage(stageName);
                        EndStage(skippedStage, true, "Skipped - no impacted automation assets detected");
                        skippedStage.Skipped = true;
                        result.AddStage(skippedStage);
                    }

                    goto Stage13;
                }

                var buildStage = StartStage("S8:Build");
                var buildValidator = new BuildValidator(_buildProjectPath);
                var buildResult = await buildValidator.ValidateAsync();
                result.BuildResult = buildResult;
                UsageTelemetryService.Current?.RecordBuildDuration((long)buildResult.Duration.TotalMilliseconds);
                EndStage(
                    buildStage,
                    buildResult.Success,
                    $"Build {(buildResult.Success ? "succeeded" : "failed")} with {buildResult.Errors.Count} error(s)",
                    buildResult.Success ? null : buildResult.Error);
                result.AddStage(buildStage);

                var testStage = StartStage("S9:ExecuteTests");
                ValidationTestValidationResult? testResult = null;
                if (buildResult.Success)
                {
                    var testValidator = new TestValidator(_testProjectPath);
                    testResult = await testValidator.ValidateAsync();
                    result.TestResult = testResult;
                    UsageTelemetryService.Current?.RecordTestDuration((long)testResult.Duration.TotalMilliseconds);
                    EndStage(
                        testStage,
                        testResult.Success,
                        $"Tests total={testResult.TotalTests}, passed={testResult.PassedTests}, failed={testResult.FailedTests}, skipped={testResult.SkippedTests}",
                        testResult.Success ? null : testResult.Error);
                }
                else
                {
                    EndStage(testStage, true, "Skipped because build failed");
                    testStage.Skipped = true;
                }
                result.AddStage(testStage);

                var s10 = StartStage("S10:AnalyzeFailures");
                var hasFailure = !buildResult.Success || (testResult != null && !testResult.Success);
                if (!hasFailure)
                {
                    EndStage(s10, true, "No failures to classify");
                    s10.Skipped = true;
                    result.AddStage(s10);

                    var s11 = StartStage("S11:SelfHeal");
                    EndStage(s11, true, "No healing required");
                    s11.Skipped = true;
                    result.AddStage(s11);

                    var s12 = StartStage("S12:Retest");
                    EndStage(s12, true, "No retest required");
                    s12.Skipped = true;
                    result.AddStage(s12);
                }
                else
                {
                    var failureText = BuildFailureText(buildResult, testResult);
                    var classification = _failureClassifier.Classify(failureText);
                    result.FailureClassification = classification;
                    EndStage(s10, true,
                        $"Classified as {classification.Category}: {classification.Reason}");
                    result.AddStage(s10);

                    var s11 = StartStage("S11:SelfHeal");
                    var correctionOutcome = await ExecuteSelfHealingAsync(
                        result,
                        plan,
                        buildResult,
                        testResult,
                        classification);
                    if (result.CorrectionAttempts.Count > 0)
                    {
                        UsageTelemetryService.Current?.IncrementSelfHealAttempts(result.CorrectionAttempts.Count);
                    }

                    EndStage(
                        s11,
                        correctionOutcome.Success,
                        correctionOutcome.Message,
                        correctionOutcome.Success ? null : correctionOutcome.Error,
                        correctionOutcome.RequiresHumanReview ? correctionOutcome.Error : null);
                    result.AddStage(s11);

                    var s12 = StartStage("S12:Retest");
                    EndStage(
                        s12,
                        correctionOutcome.Success,
                        correctionOutcome.RetrySummary,
                        correctionOutcome.Success ? null : correctionOutcome.Error,
                        correctionOutcome.RequiresHumanReview ? correctionOutcome.Error : null);
                    result.AddStage(s12);

                    if (!correctionOutcome.Success)
                    {
                        result.HumanReviewReason = correctionOutcome.Error;
                    }
                }
            }

        Stage13:
            // ===== S13: FrameworkProtection =====
            var s13 = StartStage("S13:FrameworkProtection");
            EndStage(s13, result.FrameworkModifications == 0,
                "Framework protection verified — FrameworkModifications = 0",
                result.FrameworkModifications > 0 ? "Framework was modified!" : null);
            result.AddStage(s13);

            // ===== S14: CollectUsage =====
            var s14 = StartStage("S14:CollectUsage");
            foreach (var stage in result.Stages)
            {
                telemetry.RecordStageDuration(stage.StageName, (long)stage.Duration.TotalMilliseconds);
            }

            var usage = telemetry.Snapshot(aiCredits: "NOT_AVAILABLE", estimatedCost: "NOT_AVAILABLE");
            result.Usage = usage;
            result.TokenMeasurement = usage.TotalTokens > 0
                ? usage.TotalTokens.ToString()
                : "NOT_AVAILABLE";
            result.AiCreditsMeasurement = usage.AiCredits;
            EndStage(s14, true,
                $"Usage captured: filesRead={usage.RepositoryFilesRead}, cacheHits={usage.CacheHits}, tokens={result.TokenMeasurement}");
            result.AddStage(s14);

            // ===== S15: GenerateEvidence =====
            var s15 = StartStage("S15:GenerateEvidence");
            EndStage(s15, true,
                $"Evidence: {intelligence?.EvidenceCount ?? 0} items; " +
                $"Conflicts: {intelligence?.KnowledgeConflicts?.Count ?? 0}");
            result.AddStage(s15);

            // ===== S16: Acceptance =====
            var s16 = StartStage("S16:Acceptance");
            EndStage(s16, true, "Acceptance stage completed");
            result.AddStage(s16);

            return Finalise(result, result.Stages.Any(s => s.HumanReviewState != null)
                ? "HumanReviewRequired" : "Success");
        }

        private async Task<SelfHealExecutionOutcome> ExecuteSelfHealingAsync(
            V7ExecutionResult result,
            EngineeringPlan plan,
            ValidationBuildValidationResult buildResult,
            ValidationTestValidationResult? testResult,
            FailureClassification classification)
        {
            var outcome = new SelfHealExecutionOutcome
            {
                Success = false,
                RequiresHumanReview = true,
                Message = "Self-healing started.",
                RetrySummary = "No retries executed yet."
            };

            if (!classification.IsAutoFixable || !classification.IsSafeToRetry)
            {
                outcome.Error = $"Failure is not eligible for deterministic auto-correction: {classification.Reason}";
                return outcome;
            }

            var diagnoses = new List<ErrorDiagnosis>();
            if (buildResult.Errors.Any())
            {
                diagnoses.AddRange(_errorDiagnostics.DiagnoseCompilationErrors(buildResult.Errors));
            }
            if (testResult?.Failures?.Any() == true)
            {
                diagnoses.AddRange(_errorDiagnostics.DiagnoseTestFailures(testResult.Failures));
            }

            var corrections = _autoCorrector.PlanCorrections(diagnoses)
                .OrderBy(c => c.Priority)
                .ToList();

            if (!corrections.Any())
            {
                outcome.Error = "No deterministic correction proposals generated from failure evidence.";
                return outcome;
            }

            var allowed = new HashSet<string>(
                plan.PlannedFileChanges
                    .Where(p => !string.IsNullOrWhiteSpace(p.FilePath))
                    .Select(p => NormalizePath(ResolveAbsolutePath(p.FilePath))),
                StringComparer.OrdinalIgnoreCase);

            // include diagnostic file paths if under planned scope by folder
            foreach (var d in diagnoses.Where(d => !string.IsNullOrWhiteSpace(d.FilePath)))
            {
                var absolute = Path.IsPathRooted(d.FilePath)
                    ? d.FilePath
                    : Path.Combine(_repositoryRoot, d.FilePath);
                var normalized = NormalizePath(Path.GetFullPath(absolute));
                var sameDirectoryAsPlanned = allowed.Any(p =>
                    string.Equals(Path.GetDirectoryName(p), Path.GetDirectoryName(normalized), StringComparison.OrdinalIgnoreCase));
                if (sameDirectoryAsPlanned)
                {
                    allowed.Add(normalized);
                }
            }

            var correctionAttempts = new List<CorrectionAttemptResult>();
            var retryResults = new List<RetryValidationResult>();

            for (int attempt = 1; attempt <= _maxSelfHealRetries + 1; attempt++)
            {
                var proposal = corrections.FirstOrDefault(c => IsSupportedCorrection(c.CorrectionType));
                if (proposal == null)
                {
                    outcome.Error = "Only unsupported correction types were proposed.";
                    break;
                }

                var apply = ApplyCorrectionProposal(proposal, allowed);
                correctionAttempts.Add(apply);
                result.CorrectionAttempts = correctionAttempts;

                if (!apply.Applied)
                {
                    outcome.Error = apply.Error ?? "Correction proposal could not be applied safely.";
                    break;
                }

                var buildAfter = await new BuildValidator(_buildProjectPath).ValidateAsync();
                var testAfter = buildAfter.Success
                    ? await new TestValidator(_testProjectPath).ValidateAsync()
                    : null;

                var retryResult = new RetryValidationResult
                {
                    Attempt = attempt,
                    BuildResult = buildAfter,
                    TestResult = testAfter,
                    Success = buildAfter.Success && (testAfter?.Success ?? false),
                    FailureSummary = BuildFailureText(buildAfter, testAfter)
                };
                retryResults.Add(retryResult);
                result.RetryResults = retryResults;

                if (retryResult.Success)
                {
                    outcome.Success = true;
                    outcome.RequiresHumanReview = false;
                    outcome.Message = $"Correction resolved failure on attempt {attempt}.";
                    outcome.RetrySummary = $"Resolved after {attempt} correction attempt(s).";
                    result.BuildResult = buildAfter;
                    result.TestResult = testAfter;
                    return outcome;
                }

                // failure remains; rollback this attempt before next try
                var rollback = RollbackCorrection(apply);
                result.RollbackResult = rollback;
                if (!rollback.Success)
                {
                    outcome.Error = "Rollback failed during self-healing retry.";
                    outcome.RetrySummary = $"Rollback failed at attempt {attempt}.";
                    return outcome;
                }
            }

            outcome.RetrySummary = $"Retries exhausted (max={_maxSelfHealRetries}).";
            if (string.IsNullOrWhiteSpace(outcome.Error))
            {
                outcome.Error = "Failure remains unresolved after deterministic retry limit.";
            }

            return outcome;
        }

        private CorrectionAttemptResult ApplyCorrectionProposal(CorrectionPlan plan, HashSet<string> allowedPaths)
        {
            var attempt = new CorrectionAttemptResult
            {
                AttemptedAt = DateTime.UtcNow,
                CorrectionType = plan.CorrectionType.ToString(),
                Description = plan.Description
            };

            try
            {
                string? filePath = null;
                string? newContent = null;

                if (plan.CorrectionType == CorrectionType.AddUsing && plan.Details is AddUsingCorrection addUsing)
                {
                    filePath = ResolveAbsolutePath(addUsing.FilePath);
                    var original = File.ReadAllText(filePath);
                    var usingToAdd = addUsing.SuggestedUsings?.FirstOrDefault();
                    if (string.IsNullOrWhiteSpace(usingToAdd))
                    {
                        attempt.Error = "No using directive suggested.";
                        return attempt;
                    }

                    if (original.Contains(usingToAdd, StringComparison.Ordinal))
                    {
                        attempt.Applied = true;
                        attempt.SkippedAsAlreadyApplied = true;
                        attempt.FilePath = filePath;
                        attempt.BeforeHash = ComputeHash(File.ReadAllBytes(filePath));
                        attempt.AfterHash = attempt.BeforeHash;
                        return attempt;
                    }

                    newContent = usingToAdd + Environment.NewLine + original;
                }
                else if (plan.CorrectionType == CorrectionType.FixNamespace && plan.Details is FixNamespaceCorrection nsFix)
                {
                    filePath = ResolveAbsolutePath(nsFix.FilePath);
                    var original = File.ReadAllText(filePath);
                    var expected = nsFix.SuggestedNamespace;
                    if (string.IsNullOrWhiteSpace(expected))
                    {
                        attempt.Error = "No namespace suggestion provided.";
                        return attempt;
                    }

                    newContent = ReplaceNamespace(original, expected);
                }
                else
                {
                    attempt.Error = $"Unsupported correction type: {plan.CorrectionType}";
                    return attempt;
                }

                if (string.IsNullOrWhiteSpace(filePath) || string.IsNullOrWhiteSpace(newContent))
                {
                    attempt.Error = "Correction did not resolve to concrete file/content.";
                    return attempt;
                }

                var normalized = NormalizePath(Path.GetFullPath(filePath));
                if (_protectedFilePolicy.IsProtected(filePath))
                {
                    attempt.Error = "Correction targets protected file.";
                    return attempt;
                }

                if (!allowedPaths.Contains(normalized))
                {
                    attempt.Error = "Correction target is outside allowed planned paths.";
                    return attempt;
                }

                var beforeBytes = File.ReadAllBytes(filePath);
                attempt.FilePath = filePath;
                attempt.BeforeHash = ComputeHash(beforeBytes);
                attempt.BeforeContent = Encoding.UTF8.GetString(beforeBytes);

                File.WriteAllText(filePath, newContent, Encoding.UTF8);
                var afterBytes = File.ReadAllBytes(filePath);
                attempt.AfterHash = ComputeHash(afterBytes);
                attempt.AfterContent = Encoding.UTF8.GetString(afterBytes);
                attempt.Applied = !string.Equals(attempt.BeforeHash, attempt.AfterHash, StringComparison.OrdinalIgnoreCase);

                return attempt;
            }
            catch (Exception ex)
            {
                attempt.Error = ex.Message;
                return attempt;
            }
        }

        private RollbackExecutionResult RollbackCorrection(CorrectionAttemptResult attempt)
        {
            var result = new RollbackExecutionResult
            {
                FilePath = attempt.FilePath,
                ExpectedHash = attempt.BeforeHash
            };

            try
            {
                if (!attempt.Applied || string.IsNullOrWhiteSpace(attempt.FilePath))
                {
                    result.Success = true;
                    result.ActualHash = attempt.BeforeHash;
                    return result;
                }

                File.WriteAllText(attempt.FilePath, attempt.BeforeContent ?? string.Empty, Encoding.UTF8);
                var actualHash = ComputeHash(File.ReadAllBytes(attempt.FilePath));
                result.ActualHash = actualHash;
                result.Success = string.Equals(actualHash, attempt.BeforeHash, StringComparison.OrdinalIgnoreCase);
                if (!result.Success)
                {
                    result.Error = "Restored hash mismatch.";
                }

                return result;
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Error = ex.Message;
                return result;
            }
        }

        private string ResolveAbsolutePath(string filePath)
        {
            return Path.IsPathRooted(filePath)
                ? filePath
            : Path.GetFullPath(Path.Combine(_repositoryRoot, filePath));
        }

        private static bool IsSupportedCorrection(CorrectionType t) =>
            t == CorrectionType.AddUsing || t == CorrectionType.FixNamespace;

        private static string BuildFailureText(ValidationBuildValidationResult build, ValidationTestValidationResult? test)
        {
            if (!build.Success)
            {
                var top = build.Errors.FirstOrDefault()?.Message ?? build.Error ?? "Build failed";
                return $"Build failure: {top}";
            }

            if (test != null && !test.Success)
            {
                var top = test.Failures.FirstOrDefault()?.AssertionError ?? test.Error ?? "Tests failed";
                return $"Test failure: {top}";
            }

            return "No failure";
        }

        private static string ReplaceNamespace(string content, string desiredNamespace)
        {
            var marker = "namespace ";
            var lines = content.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None).ToList();
            for (int i = 0; i < lines.Count; i++)
            {
                var trimmed = lines[i].TrimStart();
                if (trimmed.StartsWith(marker, StringComparison.Ordinal))
                {
                    var indent = lines[i].Substring(0, lines[i].Length - trimmed.Length);
                    lines[i] = indent + marker + desiredNamespace + ";";
                    return string.Join(Environment.NewLine, lines);
                }
            }

            return marker + desiredNamespace + ";" + Environment.NewLine + content;
        }

        private static string ComputeHash(byte[] bytes)
        {
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(bytes));
        }

        private static string NormalizePath(string path) =>
            path.Replace('\\', '/');

        private static bool HasKnowledgeCandidates(RepositoryKnowledgeModel repository)
        {
            return repository != null &&
                   ((repository.PageElements?.Count ?? 0) > 0 ||
                    (repository.PageActions?.Count ?? 0) > 0 ||
                    (repository.StepDefinitions?.Count ?? 0) > 0 ||
                    (repository.Features?.Count ?? 0) > 0 ||
                    (repository.PageRelationships?.Count ?? 0) > 0);
        }

        private static ContextModel BuildContextModel(RepositoryKnowledgeModel repository)
        {
            var context = new ContextModel();
            if (repository == null)
            {
                return context;
            }

            context.Methods.AddRange((repository.PageActions ?? new List<PageActionInfo>())
                .Select(a => new MethodModel
                {
                    Name = a.Name,
                    ClassName = a.ClassName,
                    Namespace = a.Namespace,
                    FilePath = a.FilePath,
                    IsAsync = a.IsAsync,
                    Score = (int)Math.Round(a.ConfidenceScore * 100)
                }));

            context.Locators.AddRange((repository.PageElements ?? new List<PageElementInfo>())
                .Select(l => new LocatorModel
                {
                    Name = l.Name,
                    PageName = l.PageOwnership,
                    FilePath = l.FilePath,
                    LocatorType = l.LocatorType,
                    Selector = l.Selector,
                    Score = (int)Math.Round(l.ConfidenceScore * 100)
                }));

            context.Steps.AddRange((repository.StepDefinitions ?? new List<StepDefinitionInfo>())
                .Select(s => new StepDefinitionModel
                {
                    StepText = s.StepText,
                    MethodName = s.MethodName,
                    FilePath = s.FilePath,
                    Score = (int)Math.Round(s.ConfidenceScore * 100)
                }));

            context.Features.AddRange((repository.Features ?? new List<FeatureFileInfo>())
                .Select(f => new FeatureModel
                {
                    Name = f.FeatureName,
                    FilePath = f.FilePath
                }));

            return context;
        }

        // ===== Stage helpers =====

        private static AgentStageRecord StartStage(string name) =>
            new() { StageName = name, StartedAt = DateTime.UtcNow };

        private static void EndStage(
            AgentStageRecord s, bool success, string output = null,
            string error = null, string humanReview = null)
        {
            s.CompletedAt    = DateTime.UtcNow;
            s.Succeeded      = success;
            s.Output         = output;
            s.Error          = error;
            s.HumanReviewState = humanReview;
        }

        private V7ExecutionResult Finalise(V7ExecutionResult r, string status)
        {
            r.FinalStatus = status;
            r.CompletedAt = DateTime.UtcNow;
            return r;
        }

        private static RepositoryKnowledgeModel BuildMinimalRepoForTestsOnly() =>
            new()
            {
                RepositoryRoot  = "TEST_ONLY",
                LastScanTime    = DateTime.UtcNow.ToString("O"),
                PageElements    = new List<PageElementInfo>(),
                PageActions     = new List<PageActionInfo>(),
                StepDefinitions = new List<StepDefinitionInfo>()
            };
    }

    // ===== Result types =====

    public class V7ExecutionResult
    {
        public string       RunId                  { get; set; }
        public string       RecordingPath         { get; set; }
        public DateTime     StartedAt             { get; set; }
        public DateTime     CompletedAt           { get; set; }
        public TimeSpan     Duration              => CompletedAt - StartedAt;
        public bool         DryRun                { get; set; }
        public string       FinalStatus           { get; set; }
        public List<AgentStageRecord> Stages      { get; set; } = new();

        // Metrics
        public int    KnowledgeRetrievedCount { get; set; }
        public int    ReuseCount              { get; set; }
        public int    ExtendCount             { get; set; }
        public int    CreateCount             { get; set; }
        public int    HumanReviewCount        { get; set; }
        public int    FilesModified           { get; set; }
        public int    FrameworkModifications  { get; set; }
        public int    CorrectionsAttempted    { get; set; }
        public int    CorrectionsSucceeded    { get; set; }
        public int    Rollbacks               { get; set; }
        public int    RepositoryFileCount     { get; set; }
        public string RepositorySnapshotHash  { get; set; } = string.Empty;
        public RepositorySnapshot? RepositorySnapshot { get; set; }
        public List<RecordedActionIntelligence> ParsedActions { get; set; } = new();
        public List<string> SelectedContextPages { get; set; } = new();
        public int RetrievedEvidenceCount { get; set; }
        public int EvidenceCount { get; set; }
        public string EngineeringPlanSummary { get; set; } = string.Empty;
        public List<ChangeRecord> ImplementationChanges { get; set; } = new();
        public ValidationBuildValidationResult? BuildResult { get; set; }
        public ValidationTestValidationResult? TestResult { get; set; }
        public FailureClassification? FailureClassification { get; set; }
        public List<CorrectionAttemptResult> CorrectionAttempts { get; set; } = new();
        public List<RetryValidationResult> RetryResults { get; set; } = new();
        public RollbackExecutionResult? RollbackResult { get; set; }
        public List<HumanReviewQuestion> HumanReviewQuestions { get; set; } = new();
        public string? HumanReviewReason { get; set; }
        public HumanApprovalResult? HumanApprovalResult { get; set; }
        public string TokenMeasurement        { get; set; } = "NOT_AVAILABLE";
        public string AiCreditsMeasurement    { get; set; } = "NOT_AVAILABLE";
        public double DeterministicRetrievalConfidence { get; set; }
        public bool AiEscalationTriggered { get; set; }
        public string AiEscalationReason { get; set; } = string.Empty;
        public string AiContextPack { get; set; } = string.Empty;
        public UsageTelemetrySnapshot? Usage { get; set; }

        public void AddStage(AgentStageRecord s) => Stages.Add(s);
    }

    public class AgentStageRecord
    {
        public string   StageName       { get; set; }
        public DateTime StartedAt       { get; set; }
        public DateTime CompletedAt     { get; set; }
        public TimeSpan Duration        => CompletedAt - StartedAt;
        public bool     Succeeded       { get; set; }
        public bool     Skipped         { get; set; }
        public string   Output          { get; set; }
        public string   Error           { get; set; }
        public string   HumanReviewState { get; set; }
    }

    public class CorrectionAttemptResult
    {
        public DateTime AttemptedAt { get; set; }
        public string CorrectionType { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? FilePath { get; set; }
        public string? BeforeHash { get; set; }
        public string? AfterHash { get; set; }
        public string? BeforeContent { get; set; }
        public string? AfterContent { get; set; }
        public bool Applied { get; set; }
        public bool SkippedAsAlreadyApplied { get; set; }
        public string? Error { get; set; }
    }

    public class RetryValidationResult
    {
        public int Attempt { get; set; }
        public ValidationBuildValidationResult? BuildResult { get; set; }
        public ValidationTestValidationResult? TestResult { get; set; }
        public bool Success { get; set; }
        public string FailureSummary { get; set; } = string.Empty;
    }

    public class RollbackExecutionResult
    {
        public string? FilePath { get; set; }
        public string? ExpectedHash { get; set; }
        public string? ActualHash { get; set; }
        public bool Success { get; set; }
        public string? Error { get; set; }
    }

    internal class SelfHealExecutionOutcome
    {
        public bool Success { get; set; }
        public bool RequiresHumanReview { get; set; }
        public string Message { get; set; } = string.Empty;
        public string RetrySummary { get; set; } = string.Empty;
        public string? Error { get; set; }
    }
}

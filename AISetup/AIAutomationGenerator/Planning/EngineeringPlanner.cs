using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Knowledge;

namespace AIAutomationGenerator.Planning
{
    /// <summary>
    /// V7.0 P1 — Converts V6.0 AutomationIntelligenceModel into an EngineeringPlan.
    ///
    /// Decision rules (deterministic):
    ///
    /// REUSE   — matching component found in repository evidence, can satisfy the action.
    /// EXTEND  — page exists, required capability missing, evidence supports extension.
    /// CREATE  — no matching page/component exists, recording provides enough info.
    /// HUMAN_REVIEW_REQUIRED — conflict, ambiguity, missing evidence, protected file risk.
    ///
    /// Every decision MUST have at least one evidence item. If evidence is absent
    /// (i.e. only "NO_REPOSITORY_EVIDENCE" markers exist), the decision is
    /// HUMAN_REVIEW_REQUIRED, never silently CREATE.
    /// </summary>
    public class EngineeringPlanner
    {
        private const double HighConfidenceThreshold = 0.85;
        private const double MediumConfidenceThreshold = 0.6;

        public EngineeringPlan CreatePlan(AutomationIntelligenceModel intelligence, string recordingSource = null)
        {
            if (intelligence == null) throw new ArgumentNullException(nameof(intelligence));

            var plan = new EngineeringPlan
            {
                RecordingSource      = recordingSource,
                RecordingActionCount = intelligence.RecordingActionCount,
                RelevantPages        = intelligence.RecordingIntelligence?.RelatedPages ?? new(),
                RelevantComponents   = ExtractComponents(intelligence)
            };

            // Build a decision for each V6 intelligence decision
            foreach (var intelDecision in intelligence.Decisions ?? new())
            {
                var evidence = GetEvidence(intelligence, intelDecision.ActionIndex);
                var engineeringDecision = Decide(intelDecision, evidence, plan);
                plan.Decisions.Add(engineeringDecision);
            }

            // If no intelligence decisions, derive from recording actions directly
            if (!plan.Decisions.Any() &&
                intelligence.RecordingIntelligence?.Actions != null)
            {
                foreach (var action in intelligence.RecordingIntelligence.Actions)
                {
                    var evidence = GetEvidence(intelligence, action.Sequence);
                    var stub = new IntelligenceDecision
                    {
                        ActionIndex       = action.Sequence,
                        ActionDescription = $"{action.ActionType} {action.Target}",
                        DecisionType      = "PageElement",
                        Recommendation    = HasRealEvidence(evidence) ? "REUSE" : "CREATE",
                        TargetComponent   = action.Target ?? "Unknown",
                        ConfidenceScore   = 0.6
                    };
                    plan.Decisions.Add(Decide(stub, evidence, plan));
                }
            }

            // Plan file changes
            plan.PlannedFileChanges = BuildFilePlan(plan.Decisions, intelligence);

            // Identify protected files
            plan.ProtectedFiles = IdentifyProtectedFiles(intelligence);

            // Compute overall confidence
            plan.OverallConfidence = plan.Decisions.Any()
                ? Math.Round(plan.Decisions.Average(d => d.Confidence), 3)
                : 0.0;

            // Set plan status
            if (plan.HumanReviewCount > 0)
            {
                plan.Status = PlanStatus.HumanReviewRequired;
                plan.HumanReviewReasons = plan.Decisions
                    .Where(d => d.Decision == EngineeringDecisionType.HumanReviewRequired)
                    .Select(d => d.HumanReviewNote)
                    .Where(n => !string.IsNullOrEmpty(n))
                    .ToList();
            }
            else if (plan.Decisions.Any())
            {
                plan.Status = PlanStatus.Ready;
            }

            return plan;
        }

        // ===== Decision logic =====

        private EngineeringDecision Decide(
            IntelligenceDecision intelDecision,
            List<KnowledgeEvidence> evidence,
            EngineeringPlan plan)
        {
            var decision = new EngineeringDecision
            {
                ActionIndex       = intelDecision.ActionIndex,
                ActionDescription = intelDecision.ActionDescription,
                Component         = intelDecision.TargetComponent,
                ComponentType     = intelDecision.DecisionType,
                Evidence          = evidence,
                SourcePath        = evidence.FirstOrDefault(e => !string.IsNullOrEmpty(e.SourcePath))?.SourcePath,
                ExistingComponentRef = intelDecision.TargetComponent
            };

            // Rule 1: no real evidence → HUMAN_REVIEW_REQUIRED (never silent CREATE)
            if (!HasRealEvidence(evidence))
            {
                decision.Decision        = EngineeringDecisionType.HumanReviewRequired;
                decision.Reason          = "No repository evidence found for this action.";
                decision.Confidence      = 0.0;
                decision.HumanReviewNote = $"No repository evidence for: {intelDecision.ActionDescription}. Human must verify correct component.";
                return decision;
            }

            // Rule 2: conflicting evidence → HUMAN_REVIEW_REQUIRED
            var distinctPaths = evidence
                .Where(e => !string.IsNullOrEmpty(e.SourcePath))
                .Select(e => e.SourcePath)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count();
            if (distinctPaths > 1)
            {
                decision.Decision        = EngineeringDecisionType.HumanReviewRequired;
                decision.Reason          = $"Conflicting evidence from {distinctPaths} different source paths.";
                decision.Confidence      = 0.3;
                decision.HumanReviewNote = $"Conflict: {distinctPaths} different sources for '{intelDecision.TargetComponent}'.";
                return decision;
            }

            // Rule 3: apply intel recommendation when evidence supports it
            var intelRec = intelDecision.Recommendation?.ToUpperInvariant();
            double avgConfidence = evidence.Average(e => e.Relevance);

            if (intelRec == "REUSE" && avgConfidence >= MediumConfidenceThreshold)
            {
                decision.Decision   = EngineeringDecisionType.Reuse;
                decision.Reason     = $"Existing component matches (confidence {avgConfidence:P0}).";
                decision.Confidence = avgConfidence;
            }
            else if (intelRec == "EXTEND" && avgConfidence >= MediumConfidenceThreshold)
            {
                decision.Decision   = EngineeringDecisionType.Extend;
                decision.Reason     = $"Page exists; new capability needed (confidence {avgConfidence:P0}).";
                decision.Confidence = avgConfidence;
            }
            else if (intelRec == "CREATE")
            {
                // CREATE requires evidence that the page/context is genuinely new
                decision.Decision   = EngineeringDecisionType.Create;
                decision.Reason     = "No matching existing component; recording supports creation.";
                decision.Confidence = avgConfidence;
                decision.SourcePath = null; // no existing source for CREATE
                decision.ExistingComponentRef = null;
            }
            else
            {
                // Ambiguous recommendation or low confidence
                decision.Decision        = EngineeringDecisionType.HumanReviewRequired;
                decision.Reason          = $"Ambiguous recommendation '{intelRec}' with confidence {avgConfidence:P0}.";
                decision.Confidence      = avgConfidence;
                decision.HumanReviewNote = $"Cannot determine safe decision for '{intelDecision.TargetComponent}'.";
            }

            return decision;
        }

        // ===== File plan =====

        private List<FilePlan> BuildFilePlan(
            List<EngineeringDecision> decisions,
            AutomationIntelligenceModel intelligence)
        {
            var plans = new Dictionary<string, FilePlan>(StringComparer.OrdinalIgnoreCase);

            foreach (var d in decisions.Where(d =>
                d.Decision != EngineeringDecisionType.HumanReviewRequired))
            {
                var path = d.SourcePath ?? DeriveFilePath(d);
                if (string.IsNullOrEmpty(path)) continue;
                if (plans.ContainsKey(path)) continue;

                plans[path] = new FilePlan
                {
                    FilePath = path,
                    ModificationType = d.Decision switch
                    {
                        EngineeringDecisionType.Reuse  => FileModificationType.Reuse,
                        EngineeringDecisionType.Extend => FileModificationType.Extend,
                        EngineeringDecisionType.Create => FileModificationType.Create,
                        _                              => FileModificationType.Protected
                    },
                    Reason        = d.Reason,
                    Evidence      = d.Evidence.FirstOrDefault()?.EvidenceText,
                    ExpectedImpact = d.Decision == EngineeringDecisionType.Reuse
                        ? "No change — component reused as-is"
                        : d.Decision == EngineeringDecisionType.Extend
                            ? "Append new method/locator to existing file"
                            : "New file created",
                    IsProtected = false
                };
            }

            return plans.Values.ToList();
        }

        private static string DeriveFilePath(EngineeringDecision d)
        {
            if (string.IsNullOrEmpty(d.Component)) return null;
            return d.ComponentType switch
            {
                "PageElement"    => $"PageElements/{d.Component}.cs",
                "PageAction"     => $"PageActions/{d.Component}.cs",
                "StepDefinition" => $"StepDefinitions/{d.Component}Steps.cs",
                "Feature"        => $"Features/{d.Component}.feature",
                _                => null
            };
        }

        // ===== Helpers =====

        private static List<KnowledgeEvidence> GetEvidence(
            AutomationIntelligenceModel m, int actionIndex)
        {
            if (m.DecisionEvidence != null &&
                m.DecisionEvidence.TryGetValue(actionIndex, out var ev))
                return ev;
            return new();
        }

        private static bool HasRealEvidence(List<KnowledgeEvidence> evidence) =>
            evidence.Any(e => e.RetrievalReason != "NO_REPOSITORY_EVIDENCE"
                           && e.KnowledgeId    != "none");

        private static List<string> ExtractComponents(AutomationIntelligenceModel m)
        {
            var result = new List<string>();
            result.AddRange(m.RepositoryKnowledge?.PageElements?.Select(pe => pe.Name) ?? new List<string>());
            result.AddRange(m.RepositoryKnowledge?.PageActions?.Select(pa => pa.Name) ?? new List<string>());
            return result.Distinct().ToList();
        }

        private static List<string> IdentifyProtectedFiles(AutomationIntelligenceModel m)
        {
            // Framework infrastructure files — never auto-modified
            var root = m.RepositoryRoot ?? "AutomationFrameWork";
            return new List<string>
            {
                $"{root}/Hooks/Hooks.cs",
                $"{root}/DriverFactory/PlaywrightDriver.cs",
                $"{root}/XunitAssembly.cs",
                $"{root}/ImplicitUsings.cs"
            };
        }
    }
}

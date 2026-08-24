using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Knowledge;
using AIAutomationGenerator.Safety;

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
        private const double CreateConfidenceFloor = 0.5;
        private readonly ProtectedFilePolicy _protectedFilePolicy;

        public EngineeringPlanner(ProtectedFilePolicy? protectedFilePolicy = null)
        {
            _protectedFilePolicy = protectedFilePolicy ?? new ProtectedFilePolicy();
        }

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
            plan.ProtectedFiles = _protectedFilePolicy.GetProtectedPaths();

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

                plan.HumanReviewQuestions = plan.Decisions
                    .Where(d => d.Decision == EngineeringDecisionType.HumanReviewRequired)
                    .Select(d => new HumanReviewQuestion
                    {
                        RunId = plan.PlanId,
                        Reason = d.Reason ?? "Ambiguous repository evidence.",
                        Question = $"Which component should action '{d.ActionDescription}' target?",
                        Options = new List<string>
                        {
                            d.SourcePath ?? "Use current proposed component",
                            "Select another existing component",
                            "Create new component"
                        },
                        Evidence = d.Evidence.Select(e => e.EvidenceText).Where(t => !string.IsNullOrWhiteSpace(t)).ToList(),
                        RecommendedOption = d.SourcePath,
                        Risk = "Protected"
                    })
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

            // Rule 2: conflicting evidence → HUMAN_REVIEW_REQUIRED (only when truly ambiguous)
            // 
            // Natural multi-layer evidence (same page, different components/layers) is ALLOWED:
            //   - PageElement "AdministrationLink" + PageAction "ClickAdministrationLink" + Step "user clicks Admin"
            //   - All from ViewDashboard page = same semantic component, different representation layers
            //
            // True conflict (different semantic purposes on different pages) is NOT allowed:
            //   - PageElement "AdministrationLink" from ViewDashboard + "CompleteLink" from ViewDeal
            //   - Two distinct pages = ambiguous which one to use
            //
            // Special case: Multiple paths with missing metadata (ambiguous origin) = NOT allowed

            var distinctPages = evidence
                .Where(e => !string.IsNullOrEmpty(e.Page))
                .Select(e => e.Page)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count();

            var distinctPaths = evidence
                .Where(e => !string.IsNullOrEmpty(e.SourcePath))
                .Select(e => e.SourcePath)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count();

            bool hasMultiplePaths = distinctPaths > 1;
            bool hasMissingMetadata = evidence.Any(e => string.IsNullOrEmpty(e.Component) || string.IsNullOrEmpty(e.Page));
            
            // Only flag conflict if: (A) different pages, OR (B) multiple paths with missing metadata
            // Multiple component names from SAME page is OK—that's multi-layer evidence.
            if (distinctPages > 1 || (hasMultiplePaths && hasMissingMetadata))
            {
                decision.Decision        = EngineeringDecisionType.HumanReviewRequired;
                decision.Reason          = $"Conflicting evidence from {distinctPages} different pages.";
                decision.Confidence      = 0.3;
                decision.HumanReviewNote = $"Conflict: evidence from different pages for '{intelDecision.TargetComponent}'.";
                return decision;
            }

            // Rule 3: apply intel recommendation when evidence supports it
            var intelRec = intelDecision.Recommendation?.ToUpperInvariant();
            double avgConfidence = evidence.Average(e => e.Relevance);

            // maxConfidence: the single best-matching evidence item.
            // S4 enrichment attaches multi-layer evidence (PageElement + PageAction + StepDefinition)
            // for the same component. PageElement/PageAction items may score 0.0 because locator
            // signal matching doesn't apply to every action type (e.g. navigate), while
            // StepDefinition items score 0.85 via semantic step text matching.
            // Averaging all items together incorrectly dilutes genuine high-confidence evidence.
            // Using maxConfidence for REUSE/EXTEND threshold: if the best single evidence item
            // strongly matches, the component exists in the repository and REUSE/EXTEND is safe.
            double maxConfidence = evidence.Max(e => e.Relevance);
            
            // Select the best-confidence evidence item for SourcePath (e.g., prefer PageElement over Step)
            var bestConfidenceItem = evidence.OrderByDescending(e => e.Relevance).FirstOrDefault();
            decision.SourcePath = bestConfidenceItem?.SourcePath ?? evidence.FirstOrDefault(e => !string.IsNullOrEmpty(e.SourcePath))?.SourcePath;

            if (intelRec == "REUSE" && maxConfidence >= MediumConfidenceThreshold)
            {
                decision.Decision   = EngineeringDecisionType.Reuse;
                decision.Reason     = $"Existing component matches (confidence {maxConfidence:P0}).";
                decision.Confidence = maxConfidence;
            }
            else if (intelRec == "EXTEND" && maxConfidence >= MediumConfidenceThreshold)
            {
                decision.Decision   = EngineeringDecisionType.Extend;
                decision.Reason     = $"Page exists; new capability needed (confidence {maxConfidence:P0}).";
                decision.Confidence = maxConfidence;
            }
            else if (intelRec == "CREATE")
            {
                // CREATE needs overall support (avg), not just one matching item
                if (avgConfidence < CreateConfidenceFloor)
                {
                    decision.Decision        = EngineeringDecisionType.HumanReviewRequired;
                    decision.Reason          = $"CREATE confidence {avgConfidence:P0} is below minimum floor {CreateConfidenceFloor:P0}.";
                    decision.Confidence      = avgConfidence;
                    decision.HumanReviewNote = $"Insufficient confidence for CREATE on '{intelDecision.TargetComponent}'.";
                    return decision;
                }

                // CREATE requires evidence that the page/context is genuinely new
                decision.Decision   = EngineeringDecisionType.Create;
                decision.Reason     = "No matching existing component; recording supports creation.";
                decision.Confidence = avgConfidence;
                decision.SourcePath = null; // no existing source for CREATE
                decision.ExistingComponentRef = null;
            }
            else
            {
                // Ambiguous recommendation or confidence below all thresholds
                decision.Decision        = EngineeringDecisionType.HumanReviewRequired;
                decision.Reason          = $"Ambiguous recommendation '{intelRec}' with confidence {maxConfidence:P0}.";
                decision.Confidence      = maxConfidence;
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
                    IsProtected = _protectedFilePolicy.IsProtected(path)
                };

                if (plans[path].IsProtected)
                {
                    plans[path].ModificationType = FileModificationType.Protected;
                }
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

    }
}

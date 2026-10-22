export type Phase7Candidate =
  | "SELF_HEALING_RETRY_POLICY"
  | "MAINTAINABILITY_DRIFT"
  | "COST_STABILITY_OPTIMIZER";

export type PriorityBand = "Low" | "Medium" | "High";

export interface Phase7Scorecard {
  candidate: Phase7Candidate;
  candidateLabel: string;
  failureFrequencyPct: number;
  impactBand: PriorityBand;
  impactScore: number;
  rerunSuccessPct: number;
  diagnosisEffortBand: PriorityBand;
  diagnosisEffortScore: number;
  priorityScore: number;
  matchedRuns: number;
  totalRuns: number;
}

export interface Phase7SelectionResult {
  generatedAtUtc: string;
  inputCounts: {
    generationReports: number;
    runtimeReports: number;
    runsAnalyzed: number;
  };
  recommendedCandidate: Phase7Scorecard | null;
  reason: string;
  scorecards: Phase7Scorecard[];
}

export interface Phase7SelectionOptions {
  generationReportInputs?: string[];
  runtimeReportInputs?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtime = require("./Phase7Selector.cjs") as {
  selectPhase7Candidate: (options: Phase7SelectionOptions) => Phase7SelectionResult;
  formatSelectionSummary: (result: Phase7SelectionResult) => string;
};

export function selectPhase7Candidate(options: Phase7SelectionOptions): Phase7SelectionResult {
  return runtime.selectPhase7Candidate(options);
}

export function formatSelectionSummary(result: Phase7SelectionResult): string {
  return runtime.formatSelectionSummary(result);
}

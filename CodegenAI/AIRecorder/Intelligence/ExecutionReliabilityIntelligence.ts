export type ExecutionReliabilityStatus = "PASS" | "WARNING" | "BLOCKED";
export type ExecutionReliabilitySeverity = "LOW" | "MEDIUM" | "HIGH";

export type ExecutionReliabilityCategory =
  | "NONE"
  | "TIMEOUT_VISIBILITY_RACE"
  | "DETACHED_OR_STALE_ELEMENT"
  | "NAVIGATION_NOT_SETTLED"
  | "POPUP_WINDOW_SYNC"
  | "ASSERTION_TIMING_MISMATCH"
  | "NETWORK_INFRA_TRANSIENT"
  | "UNKNOWN_RUNTIME_FAILURE";

export interface ExecutionReliabilityEvidence {
  failed?: boolean;
  errorMessage?: string;
  stackTrace?: string;
  stdout?: string;
  stderr?: string;
  traceEvents?: string[];
  networkErrors?: string[];
  locator?: string;
  timeoutMs?: number;
}

export interface ExecutionReliabilityRuleResult {
  ruleId: string;
  status: ExecutionReliabilityStatus;
  category: ExecutionReliabilityCategory;
  severity: ExecutionReliabilitySeverity;
  confidence: number;
  recommendation: string;
  evidence: string[];
}

export interface ExecutionReliabilityResult {
  status: ExecutionReliabilityStatus;
  blocking: boolean;
  score: number;
  category: ExecutionReliabilityCategory;
  severity: ExecutionReliabilitySeverity;
  confidence: number;
  recommendation: string;
  rules: ExecutionReliabilityRuleResult[];
  evidence: string[];
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtime = require("./ExecutionReliabilityIntelligence.cjs") as {
  classifyExecutionReliability: (evidence: ExecutionReliabilityEvidence) => ExecutionReliabilityResult;
};

export function classifyExecutionReliability(
  evidence: ExecutionReliabilityEvidence
): ExecutionReliabilityResult {
  return runtime.classifyExecutionReliability(evidence);
}

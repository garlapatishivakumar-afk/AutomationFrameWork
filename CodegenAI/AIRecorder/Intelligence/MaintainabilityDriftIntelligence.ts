export type MaintainabilityDriftStatus = "PASS" | "WARNING";
export type MaintainabilityDriftSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface DriftRuleResult {
  ruleId: string;
  status: MaintainabilityDriftStatus;
  message: string;
  evidence: string[];
}

export interface DriftHotspot {
  key: string;
  locatorChanges: number;
}

export interface DriftRunRecord {
  timestampUtc?: string;
  testName?: string;
  failed?: boolean;
  executionReliability?: {
    category?: string;
    severity?: string;
    confidence?: number;
  };
  locatorChanges?: Array<{
    key?: string;
    locatorKey?: string;
  }>;
}

export interface DriftHistory {
  runs: DriftRunRecord[];
}

export interface DriftAnalysisOptions {
  minimumRuns?: number;
}

export interface DriftAnalysisResult {
  status: MaintainabilityDriftStatus;
  severity: MaintainabilityDriftSeverity;
  driftDetected: boolean;
  driftScore: number;
  blocking: false;
  metrics: {
    totalRuns: number;
    failedRuns: number;
    failureRateOverall: number;
    failureTrendIncrease: number;
    locatorChangeCount: number;
    uniqueLocatorsChanged: number;
    maxLocatorChangesForOneKey: number;
    maxCategoryRepeat: number;
    topLocatorHotspots: Array<{ key: string; count: number }>;
    topExecutionCategories: Array<{ key: string; count: number }>;
    scoreComponents: {
      locatorChurnScore: number;
      categoryRepeatScore: number;
      failureTrendScore: number;
      failureRateScore: number;
    };
  };
  hotspots: DriftHotspot[];
  rules: DriftRuleResult[];
  recommendations: string[];
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtime = require("./MaintainabilityDriftIntelligence.cjs") as {
  analyzeMaintainabilityDrift: (history: DriftHistory, options?: DriftAnalysisOptions) => DriftAnalysisResult;
};

export function analyzeMaintainabilityDrift(
  history: DriftHistory,
  options: DriftAnalysisOptions = {}
): DriftAnalysisResult {
  return runtime.analyzeMaintainabilityDrift(history, options);
}

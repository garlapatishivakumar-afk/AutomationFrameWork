export type FailureTriageStatus = "PASS" | "WARNING" | "BLOCKED";

export type FailureTriageCategory =
  | "NONE"
  | "LOCATOR_VALIDATION"
  | "LOCATOR_REPAIR_FAILED"
  | "DOM_EVIDENCE_MISSING"
  | "GENERATION_ERROR"
  | "INPUT_ERROR"
  | "CONFIG_ERROR"
  | "UNKNOWN";

export type FailureTriageSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface FailureTriageResult {
  status: FailureTriageStatus;
  category: FailureTriageCategory;
  severity: FailureTriageSeverity;
  action: string;
  blocking: boolean;
  source: string;
  ruleIds: string[];
}

export interface FailureTriageContext {
  codeFilePath?: string;
  appSettingsPath?: string;
  codeContent?: string;
  generationError?: unknown;
  validation?: {
    success: boolean;
    errors?: string[];
    warnings?: string[];
  };
  locatorValidation?: {
    hasFailures: boolean;
    results?: any[];
  };
  locatorRepair?: {
    attempts: number;
    repairStatus: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtime = require("./FailureTriage.cjs") as {
  FailureTriage: new () => {
    classifyFailure(context: FailureTriageContext): FailureTriageResult;
  };
};

export class FailureTriage {
  private readonly inner: InstanceType<typeof runtime.FailureTriage>;

  constructor() {
    this.inner = new runtime.FailureTriage();
  }

  classifyFailure(context: FailureTriageContext): FailureTriageResult {
    return this.inner.classifyFailure(context);
  }
}

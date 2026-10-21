export type RepairStatus = "SKIPPED" | "PROPOSED" | "PASS" | "FAILED";

export interface StableAttribute {
  name: string;
  value: string;
}

export interface LocatorRepairContext {
  originalLocator: string;
  failedRuleIds: string[];
  stableAttributes: StableAttribute[];
  targetTag: string;
  suggestedLocator: string;
}

export interface LocatorRepairItem {
  sourceLine: number;
  originalLocator: string;
  repairedLocator: string;
  attempts: number;
  repairStatus: RepairStatus;
  reason?: string;
  failedRuleIds: string[];
  stableAttributes: StableAttribute[];
  targetTag: string;
  suggestedLocator: string;
  provider: string;
  codeGenerationBlocked: boolean;
}

export interface LocatorRepairSummary {
  attempts: number;
  repairStatus: RepairStatus;
  repairedAny: boolean;
  codeGenerationBlocked: boolean;
  items: LocatorRepairItem[];
  actions: any[];
  validation?: {
    severity: "PASS" | "WARNING" | "FAIL";
    failedLocators: number;
    warningLocators: number;
  };
}

export interface LocatorRepairOptions {
  domObservationPath?: string;
  maxAttempts?: number;
  repairProvider?: (context: LocatorRepairContext) => string;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtime = require("./LocatorRepair.cjs") as {
  LocatorRepair: new (options?: LocatorRepairOptions) => {
    repair(actions: any[], locatorValidation: any): LocatorRepairSummary;
    finalizeRepairResult(repairResult: LocatorRepairSummary, finalValidation: any): LocatorRepairSummary;
  };
};

export class LocatorRepair {
  private readonly inner: InstanceType<typeof runtime.LocatorRepair>;

  constructor(options: LocatorRepairOptions = {}) {
    this.inner = new runtime.LocatorRepair(options);
  }

  repair(actions: any[], locatorValidation: any): LocatorRepairSummary {
    return this.inner.repair(actions, locatorValidation);
  }

  finalizeRepairResult(repairResult: LocatorRepairSummary, finalValidation: any): LocatorRepairSummary {
    return this.inner.finalizeRepairResult(repairResult, finalValidation);
  }
}

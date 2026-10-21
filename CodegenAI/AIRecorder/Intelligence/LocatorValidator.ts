export type LocatorSeverity = "PASS" | "WARNING" | "FAIL";

export interface LocatorRuleResult {
  ruleId: string;
  status: LocatorSeverity;
  message: string;
}

export interface LocatorValidationResult {
  locator: string;
  sourceLine: number;
  severity: LocatorSeverity;
  score: number;
  rules: LocatorRuleResult[];
  suggestedLocator?: string;
}

export interface LocatorValidationSummary {
  severity: LocatorSeverity;
  hasFailures: boolean;
  totalLocators: number;
  totalLocatorActions: number;
  uniqueLocatorActions: number;
  failedLocators: number;
  warningLocators: number;
  validatedSourceLines: number[];
  results: LocatorValidationResult[];
}

export interface LocatorValidatorOptions {
  domObservationPath?: string;
  tableMetadataPath?: string;
}

// Runtime implementation lives in the CJS companion so Node-based generator can use it directly.
// This typed facade preserves TS-first integration for intelligence pipeline callers.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtime = require("./LocatorValidator.cjs") as {
  LocatorValidator: new (options?: LocatorValidatorOptions) => {
    validateActions(actions: any[]): LocatorValidationSummary;
  };
};

export class LocatorValidator {
  private readonly inner: InstanceType<typeof runtime.LocatorValidator>;

  constructor(options: LocatorValidatorOptions = {}) {
    this.inner = new runtime.LocatorValidator(options);
  }

  validateActions(actions: any[]): LocatorValidationSummary {
    return this.inner.validateActions(actions);
  }
}

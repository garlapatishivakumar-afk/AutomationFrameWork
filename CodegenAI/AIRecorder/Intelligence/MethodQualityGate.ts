export type MethodQualityStatus = "PASS" | "WARNING" | "BLOCKED";

export interface MethodQualityRuleResult {
  ruleId: string;
  status: MethodQualityStatus;
  message: string;
  methodName: string;
}

export interface MethodQualityMethodResult {
  name: string;
  status: MethodQualityStatus;
  rules: MethodQualityRuleResult[];
  isAsync: boolean;
  returnType: string;
}

export interface MethodQualityResult {
  status: MethodQualityStatus;
  blocking: boolean;
  score: number;
  rules: MethodQualityRuleResult[];
  methods: MethodQualityMethodResult[];
}

export interface MethodQualityOptions {
  blockHardcodedUrl?: boolean;
  blockHardcodedDownloadPath?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtime = require("./MethodQualityGate.cjs") as {
  evaluateMethodQuality: (code: string, options?: MethodQualityOptions) => MethodQualityResult;
};

export function evaluateMethodQuality(
  code: string,
  options: MethodQualityOptions = {}
): MethodQualityResult {
  return runtime.evaluateMethodQuality(code, options);
}

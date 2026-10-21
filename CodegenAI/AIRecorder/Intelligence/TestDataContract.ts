export type DataContractStatus = "PASS" | "WARNING" | "BLOCKED";

export interface DataContractInput {
  name: string;
  required?: boolean;
  type?: "string" | "number" | "boolean" | "array";
  multiple?: boolean;
}

export interface DataContractDefinition {
  scenario: string;
  inputs: DataContractInput[];
}

export interface DataContractTypeError {
  key: string;
  expected: string;
  actual: string;
}

export interface DataContractValidationItem {
  input: string;
  status: DataContractStatus;
  message: string;
}

export interface DataContractValidationResult {
  dataContract: {
    scenario: string;
    inputs: Array<{
      name: string;
      required: boolean;
      type: string;
      multiple: boolean;
    }>;
    status: DataContractStatus;
    blocking: boolean;
    missingKeys: string[];
    typeErrors: DataContractTypeError[];
    warnings: string[];
    results: DataContractValidationItem[];
  };
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtime = require("./TestDataContract.cjs") as {
  validateDataContract: (contract: DataContractDefinition, data: Record<string, unknown>) => DataContractValidationResult;
};

export function validateDataContract(
  contract: DataContractDefinition,
  data: Record<string, unknown>
): DataContractValidationResult {
  return runtime.validateDataContract(contract, data);
}

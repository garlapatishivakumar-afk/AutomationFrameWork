export interface ValidationError {
    rule: string;
    message: string;
    severity: "error" | "warning";
}

export interface ValidationResult {
    success: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

export declare class OutputValidator {
    validate(code: string): ValidationResult;
    validateLocatorQuality(code: string): { warnings: string[]; errors: string[] };
}

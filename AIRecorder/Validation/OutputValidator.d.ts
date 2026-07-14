export interface ValidationError {
    rule: string;
    message: string;
}

export interface ValidationResult {
    success: boolean;
    errors: ValidationError[];
}

export declare class OutputValidator {
    validate(code: string): ValidationResult;
}

export interface ValidationError {

    rule: string;

    message: string;

}

export interface ValidationResult {

    success: boolean;

    errors: ValidationError[];

}

export interface ValidationIssue {

    rule: string;

    message: string;

    severity: "Low" | "Medium" | "High";

}

export interface ValidationReport {

    isValid: boolean;

    issues: ValidationIssue[];

}

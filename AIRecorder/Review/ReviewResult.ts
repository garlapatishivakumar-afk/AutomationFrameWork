import { FixSuggestion } from "./FixSuggestion";

export interface ReviewFinding {

    ruleId: string;

    message: string;

    severity: "Low" | "Medium" | "High";

}

export interface ReviewResult {

    passed: boolean;

    findings: ReviewFinding[];

    suggestions: FixSuggestion[];

}

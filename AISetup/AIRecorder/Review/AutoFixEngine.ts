import { FixSuggestion } from "./FixSuggestion";
import { ReviewResult } from "./ReviewResult";

export class AutoFixEngine {

    public suggest(
        result: ReviewResult
    ): FixSuggestion[] {

        return result.findings.map(finding => ({
            ruleId: finding.ruleId,
            message: `Fix required for rule '${finding.ruleId}': ${finding.message}`
        }));

    }

}

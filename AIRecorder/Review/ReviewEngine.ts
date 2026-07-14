import { AutoFixEngine } from "./AutoFixEngine";
import { ReviewResult } from "./ReviewResult";
import { ReviewRules } from "./ReviewRules";

export class ReviewEngine {

    private readonly autoFixEngine =
        new AutoFixEngine();

    public review(
        content: string
    ): ReviewResult {

        const findings = [] as ReviewResult["findings"];

        if (content.includes("Thread.Sleep")) {
            findings.push({
                ruleId: "NoThreadSleep",
                message: "Thread.Sleep usage found.",
                severity: "High"
            });
        }

        if (content.includes("async") && !content.includes("await")) {
            findings.push({
                ruleId: "UseAwait",
                message: "Async usage without await found.",
                severity: "High"
            });
        }

        const enabledRuleIds =
            new Set(ReviewRules.filter(rule => rule.enabled).map(rule => rule.id));

        const filteredFindings =
            findings.filter(finding => enabledRuleIds.has(finding.ruleId));

        const interim: ReviewResult = {
            passed: filteredFindings.length === 0,
            findings: filteredFindings,
            suggestions: []
        };

        return {
            ...interim,
            suggestions: this.autoFixEngine.suggest(interim)
        };

    }

}

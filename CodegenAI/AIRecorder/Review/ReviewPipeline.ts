import { CodeReviewer } from "./CodeReviewer";
import { FixApplier } from "./FixApplier";
import { ReviewMetrics } from "./ReviewMetrics";
import { ReviewSummary } from "./ReviewSummary";

export class ReviewPipeline {

    private readonly reviewer =
        new CodeReviewer();

    private readonly fixApplier =
        new FixApplier();

    public run(
        content: string
    ): { updated: string; summary: ReviewSummary; metrics: ReviewMetrics } {

        const result = this.reviewer.reviewContent(content);

        const updated =
            this.fixApplier.apply(content, result.suggestions);

        const metrics: ReviewMetrics = {
            high: result.findings.filter(x => x.severity === "High").length,
            medium: result.findings.filter(x => x.severity === "Medium").length,
            low: result.findings.filter(x => x.severity === "Low").length,
            total: result.findings.length
        };

        const summary: ReviewSummary = {
            totalFiles: 1,
            totalFindings: result.findings.length,
            totalFixesApplied: result.suggestions.length,
            passed: result.passed
        };

        return {
            updated,
            summary,
            metrics
        };

    }

}

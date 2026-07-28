import { ReviewPipeline } from "./ReviewPipeline";
import { ReviewSummary } from "./ReviewSummary";
import { ReviewMetrics } from "./ReviewMetrics";

export class ReviewManager {

    private readonly pipeline =
        new ReviewPipeline();

    public execute(
        content: string
    ): {

        updated: string;

        summary: ReviewSummary;

        metrics: ReviewMetrics;

    } {

        return this.pipeline.run(
            content
        );

    }

}

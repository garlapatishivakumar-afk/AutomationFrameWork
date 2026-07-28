import { ReviewEngine } from "./ReviewEngine";
import { ReviewResult } from "./ReviewResult";

export class CodeReviewer {

    private readonly engine =
        new ReviewEngine();

    public reviewContent(
        content: string
    ): ReviewResult {

        return this.engine.review(content);

    }

}

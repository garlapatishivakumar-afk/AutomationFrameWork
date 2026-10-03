import { RecommendationScoreResult } from "./RecommendationScore";

export interface RecommendationDecisionResult {

    action:

        "Reuse"

        | "Update"

        | "Generate";

    confidence: number;

    semanticScore: number;

    usageScore: number;

    recencyScore: number;

    totalScore: number;

    explanation: string;

}

export class RecommendationDecision {

    private explain(
        score: RecommendationScoreResult
    ): string {

        return [

            `Semantic : ${score.semanticScore.toFixed(2)}`,

            `Usage    : ${score.usageScore.toFixed(2)}`,

            `Recency  : ${score.recencyScore.toFixed(2)}`,

            `Total    : ${score.totalScore.toFixed(2)}`

        ].join("\n");

    }

    private toPercent(
        score: number
    ): number {

        return Math.round(score * 100);

    }

    public decide(
        score: RecommendationScoreResult
    ): RecommendationDecisionResult {

        let action:

            "Reuse"

            | "Update"

            | "Generate";

        if (score.totalScore >= 0.85)

            action = "Reuse";

        else if (score.totalScore >= 0.55)

            action = "Update";

        else

            action = "Generate";

        return {

            action,

            confidence: this.toPercent(score.totalScore),

            semanticScore: score.semanticScore,

            usageScore: score.usageScore,

            recencyScore: score.recencyScore,

            totalScore: score.totalScore,

            explanation: this.explain(score)

        };

    }

}

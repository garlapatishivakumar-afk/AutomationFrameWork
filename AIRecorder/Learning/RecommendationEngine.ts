import { LearningEntry } from "./LearningModels";
import {
    RecommendationDecision,
    RecommendationDecisionResult
} from "./RecommendationDecision";
import {
    RecommendationScore,
    RecommendationScoreResult
} from "./RecommendationScore";

export interface RecommendationResult {

    entry: LearningEntry;

    score: RecommendationScoreResult;

    decision: RecommendationDecisionResult;

}

export class RecommendationEngine {

    private readonly score =
        new RecommendationScore();

    private readonly decision =
        new RecommendationDecision();

    public recommend(
        entries: LearningEntry[],
        limit = 5
    ): RecommendationResult[] {

        return entries
            .map(entry => {

                const score =
                    this.score.calculate(entry);

                const decision =
                    this.decision.decide(score);

                return {
                    entry,
                    score,
                    decision
                };

            })
            .sort((a, b) => b.score.totalScore - a.score.totalScore)
            .slice(0, limit);

    }

}

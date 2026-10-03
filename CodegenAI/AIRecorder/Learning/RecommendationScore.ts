import { LearningEntry } from "./LearningModels";

export interface RecommendationScoreResult {

    semanticScore: number;

    usageScore: number;

    recencyScore: number;

    totalScore: number;

}

export class RecommendationScore {

    private daysSince(
        isoDate: string
    ): number {

        const parsed = Date.parse(isoDate);

        if (Number.isNaN(parsed))
            return 30;

        const diffMs = Date.now() - parsed;

        return Math.max(0, diffMs / (1000 * 60 * 60 * 24));

    }

    public calculate(
        entry: LearningEntry
    ): RecommendationScoreResult {

        const semantic =
            entry.score ?? 0;

        const usage =
            Math.min(entry.usageCount / 100, 1);

        const days =
            this.daysSince(entry.lastUsed);

        const recency =
            Math.max(0, 1 - days / 30);

        const total =

            semantic * 0.60 +

            usage * 0.25 +

            recency * 0.15;

        return {

            semanticScore: semantic,

            usageScore: usage,

            recencyScore: recency,

            totalScore: total

        };

    }

}

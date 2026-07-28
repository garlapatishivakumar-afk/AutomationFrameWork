import { LearningEngine } from "./LearningEngine";
import { LearningEntry } from "./LearningModels";
import { RAGEngine } from "./RAGEngine";
import {
    RecommendationEngine,
    RecommendationResult
} from "./RecommendationEngine";

export class LearningPipeline {

    private readonly learningEngine =
        new LearningEngine();

    private readonly ragEngine =
        new RAGEngine();

    private readonly recommendationEngine =
        new RecommendationEngine();

    public run(
        entries: LearningEntry[],
        query: string
    ): RecommendationResult[] {

        this.learningEngine.ingest(entries);

        const retrieved =
            this.ragEngine.retrieve(
                this.learningEngine.getKnowledgeBase(),
                query
            );

        return this.recommendationEngine.recommend(retrieved);

    }

    public getLearningEngine(): LearningEngine {

        return this.learningEngine;

    }

}

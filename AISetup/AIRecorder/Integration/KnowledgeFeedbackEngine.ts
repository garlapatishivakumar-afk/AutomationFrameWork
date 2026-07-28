import { LearningEngine } from "../Learning/LearningEngine";
import { LearningEntry } from "../Learning/LearningModels";
import { RAGEngine } from "../Learning/RAGEngine";
import { RecommendationEngine } from "../Learning/RecommendationEngine";
import { FeedbackResult } from "./FeedbackResult";

export class KnowledgeFeedbackEngine {

    private readonly learning =
        new LearningEngine();

    private readonly rag =
        new RAGEngine();

    private readonly recommendation =
        new RecommendationEngine();

    public process(
        generatedCode: string,
        reviewMessages: string[]
    ): FeedbackResult {

        const entries =
            this.toEntries(
                generatedCode,
                reviewMessages
            );

        this.learning.ingest(entries);

        const query =
            reviewMessages.length > 0
                ? reviewMessages.join(" ")
                : generatedCode.slice(0, 120);

        const retrieved =
            this.rag.retrieve(
                this.learning.getKnowledgeBase(),
                query
            );

        const recommendations =
            this.recommendation.recommend(retrieved);

        return {
            ingestedCount: entries.length,
            retrievedCount: retrieved.length,
            recommendations,
            knowledgeSize: this.learning.getKnowledgeBase().size()
        };

    }

    private toEntries(
        generatedCode: string,
        reviewMessages: string[]
    ): LearningEntry[] {

        const now =
            new Date().toISOString();

        const entries: LearningEntry[] = [
            {
                key: `Generated_${now}`,
                value: generatedCode,
                source: "GeneratedCode",
                score: 1,
                usageCount: 1,
                lastUsed: now
            }
        ];

        for (let i = 0; i < reviewMessages.length; i++) {

            entries.push({
                key: `Review_${i + 1}_${now}`,
                value: reviewMessages[i],
                source: "Review",
                score: 1,
                usageCount: 1,
                lastUsed: now
            });

        }

        return entries;

    }

}

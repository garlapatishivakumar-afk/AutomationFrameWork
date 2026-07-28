import { ArtifactExtractor } from "./ArtifactExtractor";
import { LearningEvent } from "./LearningEvent";
import { LearningMetrics } from "./LearningMetrics";
import { LearningPipeline } from "./LearningPipeline";

export class LearningOrchestrator {

    private readonly extractor =
        new ArtifactExtractor();

    private readonly pipeline =
        new LearningPipeline();

    public run(
        content: string,
        source: string,
        query: string
    ): {

        events: LearningEvent[];

        metrics: LearningMetrics;

    } {

        const entries =
            this.extractor.fromContent(content, source);

        const recommendations =
            this.pipeline.run(entries, query);

        const now =
            new Date().toISOString();

        const events: LearningEvent[] = [
            {
                type: "KnowledgeIngested",
                artifactType: source,
                name: `${entries.length} entries`,
                timestamp: now
            },
            ...recommendations.map(result => {

                let eventType: LearningEvent["type"];

                if (result.decision.action === "Reuse")
                    eventType = "ArtifactReused";

                else if (result.decision.action === "Update")
                    eventType = "ArtifactUpdated";

                else
                    eventType = "ArtifactGenerated";

                return {
                    type: eventType,
                    artifactType: result.entry.source,
                    name: result.entry.key,
                    timestamp: now,
                    metadata: {
                        confidence: `${result.decision.confidence}`,
                        action: result.decision.action,
                        score: `${result.decision.totalScore.toFixed(2)}`,
                        explanation: result.decision.explanation
                    }
                };

            })
        ];

        const metrics: LearningMetrics = {
            totalEvents: events.length,
            generatedCount: events.filter(x => x.type === "ArtifactGenerated").length,
            reusedCount: events.filter(x => x.type === "ArtifactReused").length,
            updatedCount: events.filter(x => x.type === "ArtifactUpdated").length,
            ingestedCount: events.filter(x => x.type === "KnowledgeIngested").length
        };

        return {
            events,
            metrics
        };

    }

}

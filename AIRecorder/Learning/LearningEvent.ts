export interface LearningEvent {

    type: "ArtifactGenerated" | "ArtifactReused" | "ArtifactUpdated" | "KnowledgeIngested";

    artifactType: string;

    name: string;

    timestamp: string;

    metadata?: Record<string, string>;

}

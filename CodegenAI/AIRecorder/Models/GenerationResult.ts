import { AIArtifact } from "./AIArtifact";

export interface GenerationResult {

    success: boolean;

    artifacts: AIArtifact[];

    summary?: string;

    prompt: string;

    response: string;

    detectedPages?: string[];

    includedFiles?: string[];

    decisionPages?: string[];

    decisionRequested?: number;

    decisionToGenerate?: number;

    decisionSkippedOrReused?: number;
}

import { GeneratedArtifact } from "./ArtifactModels";

export interface GenerationResult {

    success: boolean;

    artifacts: GeneratedArtifact[];

    errors: string[];

}

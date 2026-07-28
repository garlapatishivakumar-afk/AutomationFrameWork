export interface ArtifactManifest {

    generatedFiles: string[];

    createdTime: string;

    version: string;

    provider: string;

    promptHash: string;

    tokens: number;

    latencyMs: number;

}

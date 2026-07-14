export type ArtifactType =
    | "Method"
    | "Locator"
    | "Step"
    | "Feature"
    | "Helper"
    | "Excel";

export interface ArtifactRequest {

    type: ArtifactType;

    name: string;

    prompt: string;

}

export interface GeneratedArtifact {

    type: ArtifactType;

    name: string;

    content: string;

}

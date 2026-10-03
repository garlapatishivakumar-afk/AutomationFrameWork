export interface AIArtifact {

    artifactType:
        | "Method"
        | "Locator"
        | "Step"
        | "Scenario"
        | "Helper"
        | "Excel";

    targetFile: string;

    targetClass?: string;

    name: string;

    content: string;

}

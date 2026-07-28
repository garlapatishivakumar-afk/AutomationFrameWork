import { ArtifactRequest, GeneratedArtifact } from "./ArtifactModels";

export class StepGenerator {

    public generate(
        request: ArtifactRequest
    ): GeneratedArtifact {

        return {
            type: "Step",
            name: request.name,
            content: ""
        };

    }

}

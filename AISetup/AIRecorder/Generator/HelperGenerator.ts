import { ArtifactRequest, GeneratedArtifact } from "./ArtifactModels";

export class HelperGenerator {

    public generate(
        request: ArtifactRequest
    ): GeneratedArtifact {

        return {
            type: "Helper",
            name: request.name,
            content: ""
        };

    }

}

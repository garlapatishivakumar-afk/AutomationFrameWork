import { ArtifactRequest, GeneratedArtifact } from "./ArtifactModels";

export class MethodGenerator {

    public generate(
        request: ArtifactRequest
    ): GeneratedArtifact {

        return {
            type: "Method",
            name: request.name,
            content: ""
        };

    }

}

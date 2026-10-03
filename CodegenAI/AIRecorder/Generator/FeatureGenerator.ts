import { ArtifactRequest, GeneratedArtifact } from "./ArtifactModels";

export class FeatureGenerator {

    public generate(
        request: ArtifactRequest
    ): GeneratedArtifact {

        return {
            type: "Feature",
            name: request.name,
            content: ""
        };

    }

}

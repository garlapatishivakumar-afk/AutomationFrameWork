import { ArtifactRequest, GeneratedArtifact } from "./ArtifactModels";

export class LocatorGenerator {

    public generate(
        request: ArtifactRequest
    ): GeneratedArtifact {

        return {
            type: "Locator",
            name: request.name,
            content: ""
        };

    }

}

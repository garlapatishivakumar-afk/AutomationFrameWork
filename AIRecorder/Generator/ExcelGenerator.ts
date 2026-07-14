import { ArtifactRequest, GeneratedArtifact } from "./ArtifactModels";

export class ExcelGenerator {

    public generate(
        request: ArtifactRequest
    ): GeneratedArtifact {

        return {
            type: "Excel",
            name: request.name,
            content: ""
        };

    }

}

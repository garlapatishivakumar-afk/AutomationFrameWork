import { ArtifactGenerator } from "./ArtifactGenerator";
import { ArtifactRequest, GeneratedArtifact } from "./ArtifactModels";

export class MultiFileGenerator {

    private readonly artifactGenerator =
        new ArtifactGenerator();

    public generateAll(
        requests: ArtifactRequest[]
    ): GeneratedArtifact[] {

        return requests.map(request =>
            this.artifactGenerator.generate(request)
        );

    }

}

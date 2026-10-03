import { GeneratedArtifact } from "./ArtifactModels";
import { ValidationResult } from "./ValidationResult";

export class ArtifactValidator {

    public validate(
        artifact: GeneratedArtifact
    ): ValidationResult {

        const errors = [] as ValidationResult["errors"];

        if (!artifact.name.trim()) {
            errors.push({
                rule: "Name",
                message: "Artifact name is empty."
            });
        }

        if (!artifact.content.trim()) {
            errors.push({
                rule: "Content",
                message: "Artifact content is empty."
            });
        }

        return {
            success: errors.length === 0,
            errors
        };

    }

}

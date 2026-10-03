import { ArtifactRequest } from "./ArtifactModels";
import { ArtifactValidator } from "./ArtifactValidator";
import { FrameworkIntegrator } from "./FrameworkIntegrator";
import { GenerationSummary } from "./GenerationSummary";
import { MultiFileGenerator } from "./MultiFileGenerator";

export class GenerationPipeline {

    private readonly generator =
        new MultiFileGenerator();

    private readonly validator =
        new ArtifactValidator();

    private readonly integrator =
        new FrameworkIntegrator();

    public run(
        requests: ArtifactRequest[]
    ): GenerationSummary {

        const generated =
            this.generator.generateAll(requests);

        const validated =
            generated.filter(artifact =>
                this.validator.validate(artifact).success
            );

        const integratedCount =
            this.integrator.integrate(validated);

        return {
            totalRequested: requests.length,
            totalGenerated: generated.length,
            totalValidated: validated.length,
            totalIntegrated: integratedCount,
            notes: []
        };

    }

}

import { ArtifactRequest, GeneratedArtifact } from "./ArtifactModels";
import { ExcelGenerator } from "./ExcelGenerator";
import { FeatureGenerator } from "./FeatureGenerator";
import { HelperGenerator } from "./HelperGenerator";
import { LocatorGenerator } from "./LocatorGenerator";
import { MethodGenerator } from "./MethodGenerator";
import { StepGenerator } from "./StepGenerator";

export class ArtifactGenerator {

    private readonly methodGenerator =
        new MethodGenerator();

    private readonly locatorGenerator =
        new LocatorGenerator();

    private readonly stepGenerator =
        new StepGenerator();

    private readonly featureGenerator =
        new FeatureGenerator();

    private readonly helperGenerator =
        new HelperGenerator();

    private readonly excelGenerator =
        new ExcelGenerator();

    public generate(
        request: ArtifactRequest
    ): GeneratedArtifact {

        switch (request.type) {

            case "Method":
                return this.methodGenerator.generate(request);

            case "Locator":
                return this.locatorGenerator.generate(request);

            case "Step":
                return this.stepGenerator.generate(request);

            case "Feature":
                return this.featureGenerator.generate(request);

            case "Helper":
                return this.helperGenerator.generate(request);

            case "Excel":
                return this.excelGenerator.generate(request);

            default:
                return {
                    type: request.type,
                    name: request.name,
                    content: ""
                };

        }

    }

}

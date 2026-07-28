import { ExistingCodeCollector } from "./ExistingCodeCollector";
import { FrameworkRules } from "./FrameworkRules";
import { GeneratorContext } from "./ContextModels";

export class FrameworkContextBuilder {

    private readonly collector =
        new ExistingCodeCollector();

    public build(
        featureName: string,
        pageName: string,
        application: string,
        objective: string
    ): GeneratorContext {

        return {

            featureName,

            pageName,

            application,

            objective,

            existingCode: this.collector.collect(),

            rules: FrameworkRules

        };

    }

}

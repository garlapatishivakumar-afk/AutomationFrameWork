import { PromptContext } from "./PromptModels";

export class ContextBuilder {

    public build(
        featureName: string,
        pageName: string,
        application: string,
        objective: string,
        constraints: string[] = []
    ): PromptContext {

        return {

            featureName,

            pageName,

            application,

            objective,

            constraints

        };

    }

}

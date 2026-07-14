import { PromptRequest, PromptResult } from "./PromptModels";
import { getTemplate } from "./PromptTemplates";

export class PromptBuilder {

    public build(
        request: PromptRequest
    ): PromptResult {

        const header =
            getTemplate(request.templateName);

        const body = [
            `Feature: ${request.context.featureName}`,
            `Page: ${request.context.pageName}`,
            `Application: ${request.context.application}`,
            `Objective: ${request.context.objective}`,
            `Constraints: ${request.context.constraints.join(", ") || "None"}`
        ].join("\\n");

        return {

            prompt: `${header}\\n\\n${body}`,

            metadata: {
                templateName: request.templateName,
                featureName: request.context.featureName,
                pageName: request.context.pageName
            }

        };

    }

}

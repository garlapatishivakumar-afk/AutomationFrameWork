import { GeneratorContext } from "./ContextModels";

export class PromptAssembler {

    private toBulletList(
        values: string[]
    ): string {

        if (values.length === 0)
            return "- None";

        return values.map(x => `- ${x}`).join("\\n");

    }

    private rulesByKeyword(
        context: GeneratorContext,
        keyword: string
    ): string {

        const filtered = context.rules
            .filter(rule => rule.description.toLowerCase().includes(keyword))
            .map(rule => `- [${rule.id}] ${rule.description}`);

        return filtered.length > 0
            ? filtered.join("\\n")
            : "- None";

    }

    public assemble(
        context: GeneratorContext
    ): string {

        const allRules =
            context.rules
                .map(rule => `- [${rule.id}] ${rule.description}`)
                .join("\\n");

        const codingRules =
            this.rulesByKeyword(context, "naming")
            + "\\n"
            + this.rulesByKeyword(context, "responsibility")
            + "\\n"
            + this.rulesByKeyword(context, "duplicate");

        const playwrightRules =
            this.rulesByKeyword(context, "playwright")
            + "\\n"
            + this.rulesByKeyword(context, "await")
            + "\\n"
            + this.rulesByKeyword(context, "wait");

        const frameworkStructure = [
            "- PageActions/",
            "- PageElements/",
            "- StepDefinitions/",
            "- Features/",
            "- Helpers/",
            "- DataFiles/"
        ].join("\\n");

        const outputFormat = [
            "- Return JSON only.",
            "- No markdown fences.",
            "- Include only missing artifacts.",
            "- Preserve existing naming and architecture."
        ].join("\\n");

        const jsonSchema = [
            "{",
            "  \"methods\": [\"string\"],",
            "  \"locators\": [\"string\"],",
            "  \"steps\": [\"string\"],",
            "  \"scenarios\": [\"string\"],",
            "  \"helpers\": [\"string\"],",
            "  \"excel\": [\"string\"]",
            "}"
        ].join("\\n");

        const examples = [
            "Example method name: VerifyAdminTabAsync",
            "Example locator name: SubmitButton",
            "Example step: Given I navigate to the DocAdmin application url"
        ].join("\\n");

        return [
            "SYSTEM",
            "You are an enterprise automation engineer generating only required framework deltas.",
            "",
            "ROLE",
            "Act as a senior automation architect for a Playwright + BDD enterprise framework.",
            "",
            "OBJECTIVE",
            context.objective,
            "",
            "FRAMEWORK STRUCTURE",
            frameworkStructure,
            "",
            `Application: ${context.application}`,
            `Feature: ${context.featureName}`,
            `Page: ${context.pageName}`,
            "",
            "EXISTING METHODS",
            this.toBulletList(context.existingCode.methods),
            "",
            "EXISTING LOCATORS",
            this.toBulletList(context.existingCode.locators),
            "",
            "EXISTING STEPS",
            this.toBulletList(context.existingCode.steps),
            "",
            "EXISTING SCENARIOS",
            this.toBulletList(context.existingCode.scenarios),
            "",
            "HELPERS",
            this.toBulletList(context.existingCode.helpers),
            "",
            "FRAMEWORK RULES",
            allRules,
            "",
            "CODING RULES",
            codingRules,
            "",
            "PLAYWRIGHT RULES",
            playwrightRules,
            "",
            "OUTPUT FORMAT",
            outputFormat,
            "",
            "JSON SCHEMA",
            jsonSchema,
            "",
            "EXAMPLES",
            examples
        ].join("\\n");

    }

}

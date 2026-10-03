import { GenerationOrchestrator } from "./GenerationOrchestrator";
import { LLMConfiguration } from "./LLMConfiguration";

async function run(): Promise<void> {

    const llmConfiguration: LLMConfiguration = {
        provider: "OpenAI",
        model: "gpt-5.3-codex",
        temperature: 0.2,
        maxTokens: 2000
    };

    const orchestrator =
        new GenerationOrchestrator();

    const result =
        await orchestrator.run({
            templateName: "default",
            featureName: "Login",
            pageName: "Login",
            application: "CashAdmin",
            objective: "Generate login automation code",
            constraints: ["Reuse existing methods", "No duplicate locators"],
            retrievedCount: 3,
            configuration: llmConfiguration
        });

    console.log({
        provider: result.provider,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        latencyMs: result.latencyMs,
        finishReason: result.finishReason
    });

}

run().catch(error => {

    console.error(error);
    process.exit(1);

});

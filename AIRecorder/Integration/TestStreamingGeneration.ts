import { LLMConfiguration } from "./LLMConfiguration";
import {
    StreamingGenerationOrchestrator,
    StreamingGenerationInput
} from "./StreamingGenerationOrchestrator";
import { SimulatedStreamingLLMClient } from "./StreamingLLMClient";

function assertCondition(
    condition: boolean,
    message: string
): void {

    if (!condition)
        throw new Error(message);

}

async function runSuccessCase(
    input: StreamingGenerationInput
): Promise<void> {

    const orchestrator =
        new StreamingGenerationOrchestrator();

    const tokenSequence: string[] = [];

    let started = false;
    let completed = false;

    const result =
        await orchestrator.run({
            ...input,
            callbacks: {
                onStarted: () => {
                    started = true;
                },
                onToken: token => {
                    tokenSequence.push(token);
                },
                onCompleted: () => {
                    completed = true;
                }
            }
        });

    assertCondition(started, "Streaming did not start");
    assertCondition(tokenSequence.length > 0, "No streaming tokens received");
    assertCondition(result.content === tokenSequence.join(""), "Token accumulation mismatch");
    assertCondition(completed, "Completion callback was not called");
    assertCondition(result.totalTokens > 0, "Total tokens not populated");
    assertCondition(result.latencyMs >= 0, "Latency is invalid");
    assertCondition(result.finishReason.length > 0, "Finish reason not populated");

    console.log({
        successCase: true,
        tokenCount: tokenSequence.length,
        totalTokens: result.totalTokens,
        latencyMs: result.latencyMs,
        finishReason: result.finishReason
    });

}

async function runErrorCase(
    input: StreamingGenerationInput
): Promise<void> {

    const orchestrator =
        new StreamingGenerationOrchestrator(
            new SimulatedStreamingLLMClient(5)
        );

    let errorCallbackCalled = false;
    let thrown = false;

    try {

        await orchestrator.run({
            ...input,
            callbacks: {
                onError: () => {
                    errorCallbackCalled = true;
                }
            }
        });

    }
    catch {

        thrown = true;

    }

    assertCondition(errorCallbackCalled, "Error callback was not called");
    assertCondition(thrown, "Streaming error was not thrown");

    console.log({
        errorCase: true,
        errorCallbackCalled,
        thrown
    });

}

async function run(): Promise<void> {

    const configuration: LLMConfiguration = {
        provider: "OpenAI",
        model: "gpt-5.3-codex",
        temperature: 0.2,
        maxTokens: 2000
    };

    const input: StreamingGenerationInput = {
        templateName: "default",
        featureName: "Login",
        pageName: "Login",
        application: "CashAdmin",
        objective: "Generate login automation code",
        constraints: ["Reuse existing methods", "No duplicate locators"],
        retrievedCount: 3,
        configuration
    };

    await runSuccessCase(input);
    await runErrorCase(input);

}

run().catch(error => {

    console.error(error);
    process.exit(1);

});

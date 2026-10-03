import { AIPipeline } from "./AIPipeline";

async function run(): Promise<void> {

    const pipeline =
        new AIPipeline();

    const result =
        await pipeline.run({
            requestId: "phase8-smoke",
            projectRoot: ".",
            objective: "Create login automation artifacts",
            query: "login page methods and steps",
            templateName: "default",
            constraints: ["Reuse existing methods", "No duplicate locators"],
            featureName: "Login",
            pageName: "Login",
            application: "CashAdmin"
        });

    console.log({
        success: result.success,
        status: result.status,
        executionId: result.executionId,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        executionTimeMs: result.executionTimeMs,
        plannerActions: result.planning?.actions.length ?? 0,
        intelligenceVersion: result.intelligence?.versioned.version ?? 0,
        generated: result.generation?.generationSummary.totalGenerated ?? 0,
        reviewFindings: result.generation?.review.findings.length ?? 0,
        feedbackIngested: result.feedback?.ingestedCount ?? 0,
        feedbackRecommendations: result.feedback?.recommendations.length ?? 0
    });

}

run().catch(error => {

    console.error(error);
    process.exit(1);

});

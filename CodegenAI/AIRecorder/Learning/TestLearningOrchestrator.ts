import { LearningOrchestrator } from "./LearningOrchestrator";

const orchestrator =
    new LearningOrchestrator();

const result =
    orchestrator.run(
        [
            "OpenDealsCompletionStatusPageAsync",
            "ApproveDealAsync",
            "RejectDealAsync",
            "DealViewAmountLinks"
        ].join("\n"),
        "Method",
        "Open Deal Page"
    );

console.log(result);

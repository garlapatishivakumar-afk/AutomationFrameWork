import { KnowledgeLoader } from "./KnowledgeLoader";

const loader =
    new KnowledgeLoader();

const snapshot =
    loader.load(
        "AutomationFramework",
        [
            "package.json",
            "CodegenAI/AIRecorder/Planner/PlanningEngine.ts",
            "PageActions/DealsMethods.cs",
            "Deals.csproj",
            "CodegenAI/AIRecorder/PageElements/DealsLocators.cs",
            "CodegenAI/AIRecorder/StepDefinitions/DealsSteps.cs"
        ]
    );

console.log(snapshot);

import { KnowledgeLoader } from "./KnowledgeLoader";

const loader =
    new KnowledgeLoader();

const snapshot =
    loader.load(
        "AutomationFramework",
        [
            "package.json",
            "AIRecorder/Planner/PlanningEngine.ts",
            "PageActions/DealsMethods.cs",
            "Deals.csproj",
            "AIRecorder/PageElements/DealsLocators.cs",
            "AIRecorder/StepDefinitions/DealsSteps.cs"
        ]
    );

console.log(snapshot);

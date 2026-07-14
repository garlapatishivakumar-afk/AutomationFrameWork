import { FileLocator } from "./FileLocator";
import { PlannerContext } from "./PlannerContext";
import { PlannedAction } from "./PlannerModels";

export class ActionPlanner {

    private readonly fileLocator =
        new FileLocator();

    public buildActions(
        context: PlannerContext
    ): PlannedAction[] {

        const actions: PlannedAction[] = [];

        for (const method of context.requiredMethods) {

            actions.push({

                type: "Create",

                artifactType: "Method",

                name: method,

                filePath: this.fileLocator.locate(context.projectRoot, "Method", method),

                reason: "Missing method detected.",

                dependencies: [],

                priority: 2,

                estimatedTokens: 500

            });

        }

        for (const locator of context.requiredLocators) {

            actions.push({

                type: "Create",

                artifactType: "Locator",

                name: locator,

                filePath: this.fileLocator.locate(context.projectRoot, "Locator", locator),

                reason: "Missing locator detected.",

                dependencies: [],

                priority: 1,

                estimatedTokens: 180

            });

        }

        for (const step of context.requiredSteps) {

            actions.push({

                type: "Create",

                artifactType: "Step",

                name: step,

                filePath: this.fileLocator.locate(context.projectRoot, "Step", step),

                reason: "Missing step detected.",

                dependencies: [],

                priority: 3,

                estimatedTokens: 700

            });

        }

        for (const scenario of context.requiredScenarios) {

            actions.push({

                type: "Create",

                artifactType: "Scenario",

                name: scenario,

                filePath: this.fileLocator.locate(context.projectRoot, "Scenario", scenario),

                reason: "Missing scenario detected.",

                dependencies: [],

                priority: 4,

                estimatedTokens: 900

            });

        }

        for (const helper of context.requiredHelpers) {

            actions.push({

                type: "Create",

                artifactType: "Helper",

                name: helper,

                filePath: this.fileLocator.locate(context.projectRoot, "Helper", helper),

                reason: "Missing helper detected.",

                dependencies: [],

                priority: 2,

                estimatedTokens: 350

            });

        }

        if (context.createExcel) {

            actions.push({

                type: "Create",

                artifactType: "Excel",

                name: "DataFile",

                filePath: this.fileLocator.locate(context.projectRoot, "Excel", "DataFile"),

                reason: "Input fields require data file support.",

                dependencies: [],

                priority: 1,

                estimatedTokens: 220

            });

        }

        return actions;

    }

}

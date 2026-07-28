import { PlannedAction } from "./PlannerModels";

export class DependencyBuilder {

    public build(
        actions: PlannedAction[]
    ): PlannedAction[] {

        const hasScenario =
            actions.some(x => x.artifactType === "Scenario");

        const hasStep =
            actions.some(x => x.artifactType === "Step");

        const hasMethod =
            actions.some(x => x.artifactType === "Method");

        const hasLocator =
            actions.some(x => x.artifactType === "Locator");

        const hasExcel =
            actions.some(x => x.artifactType === "Excel");

        for (const action of actions) {

            action.dependencies = [];

            switch (action.artifactType) {

                case "Scenario":

                    if (hasStep)
                        action.dependencies.push("Step");

                    break;

                case "Step":

                    if (hasMethod)
                        action.dependencies.push("Method");

                    break;

                case "Method":

                    if (hasLocator)
                        action.dependencies.push("Locator");

                    if (hasExcel)
                        action.dependencies.push("Excel");

                    break;

            }

        }

        return actions;

    }

}

export default DependencyBuilder;
import { DependencyGraph, PlannedAction } from "./PlannerModels";

export class DependencyResolver {

    public buildGraph(
        actions: PlannedAction[]
    ): DependencyGraph {

        // Phase 3.2: derive dependency chains such as Scenario -> Step -> Method -> Locator -> Excel.

        const nodes = actions.map(action => action.name);

        const edges: Record<string, string[]> = {};

        for (const action of actions) {

            edges[action.name] = [...action.dependencies];

        }

        return {

            nodes,

            edges

        };

    }

}

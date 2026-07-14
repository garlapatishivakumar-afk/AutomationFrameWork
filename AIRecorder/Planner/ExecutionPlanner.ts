import { PlannedAction } from "./PlannerModels";

export class ExecutionPlanner {

    public order(
        actions: PlannedAction[]
    ): PlannedAction[] {

        const ordered: PlannedAction[] = [];
        const visited = new Set<string>();

        while (ordered.length < actions.length) {

            let progress = false;

            for (const action of actions) {

                if (visited.has(action.name))
                    continue;

                const ready =
                    action.dependencies.every(d =>
                        visited.has(d) ||
                        !actions.some(a => a.artifactType === d)
                    );

                if (!ready)
                    continue;

                ordered.push(action);

                visited.add(action.name);

                progress = true;

            }

            if (!progress)
                throw new Error(
                    "Circular dependency detected."
                );

        }

        return ordered;

    }

}
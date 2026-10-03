import { PlannedAction } from "./PlannerModels";

export class ChangeDetector {

    public detect(
        actions: PlannedAction[]
    ): string[] {

        const changes: string[] = [];

        for (const action of actions) {
            changes.push(`${action.type}:${action.artifactType}:${action.name}`);
        }

        return changes;

    }

}

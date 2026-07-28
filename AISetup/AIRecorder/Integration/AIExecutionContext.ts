import { PlannerContext } from "../Planner/PlannerContext";

export interface AIExecutionContext {

    requestId: string;

    projectRoot: string;

    objective: string;

    query: string;

    templateName: string;

    constraints: string[];

    plannerContext: PlannerContext;

}

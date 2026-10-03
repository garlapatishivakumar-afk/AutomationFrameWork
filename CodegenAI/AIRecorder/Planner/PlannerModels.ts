import { RelationshipGraph } from "./RelationshipGraph";
import { ReuseResult } from "./ReuseResult";
import { ImpactReport } from "./ImpactReport";
import { ValidationReport } from "./ValidationReport";
export type PlanActionType =
    | "Create"
    | "Update"
    | "Reuse"
    | "Skip";

export type ArtifactType =
    | "Method"
    | "Locator"
    | "Step"
    | "Scenario"
    | "Helper"
    | "Excel";

export interface PlannedAction {

    type: PlanActionType;

    artifactType: ArtifactType;

    name: string;

    filePath: string;

    reason: string;

    dependencies: string[];

    priority: number;

    estimatedTokens: number;

}

export interface DependencyGraph {

    nodes: string[];

    edges: Record<string, string[]>;

}

export interface PlanningResult {

    actions: PlannedAction[];

    dependencyGraph: DependencyGraph;

    relationshipGraph: RelationshipGraph;

    reuseResult: ReuseResult;

    impactReport: ImpactReport;

    validationReport: ValidationReport;

}

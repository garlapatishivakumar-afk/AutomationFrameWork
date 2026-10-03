import { ActionPlanner } from "./ActionPlanner";
import { DependencyResolver } from "./DependencyResolver";
import { PlannerContext } from "./PlannerContext";
import { PlanningResult } from "./PlannerModels";
import { RelationshipAnalyzer } from "./RelationshipAnalyzer";
import { ExecutionPlanner } from "./ExecutionPlanner";
import { ReusePlanner } from "./ReusePlanner";
import { ImpactAnalyzer } from "./ImpactAnalyzer";
import { PlanValidator } from "./PlanValidator";

export class PlanningEngine {

    private readonly actionPlanner =
        new ActionPlanner();

    private readonly dependencyResolver =
        new DependencyResolver();

    private readonly relationshipAnalyzer =
        new RelationshipAnalyzer();

    private readonly executionPlanner =
        new ExecutionPlanner();

    private readonly reusePlanner =
        new ReusePlanner();

    private readonly impactAnalyzer =
        new ImpactAnalyzer();

    private readonly validator =
        new PlanValidator();

    public plan(
        context: PlannerContext
    ): PlanningResult {

        const actions =
            this.actionPlanner.buildActions(context);

        const ordered =
            this.executionPlanner.order(actions);

        const graph =
            this.dependencyResolver.buildGraph(ordered);

        const relationships =
            this.relationshipAnalyzer.build([]);

        const reuse =
            this.reusePlanner.plan(
                ordered,
                []
            );

        const impact =
            this.impactAnalyzer.analyze(
                ordered
            );

        const validation =
            this.validator.validate(
                ordered
            );

        return {

    actions: ordered,

    dependencyGraph: graph,

    relationshipGraph: relationships,

    reuseResult: reuse,

    impactReport: impact,

    validationReport: validation

};

    }

}
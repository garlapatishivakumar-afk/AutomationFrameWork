import { PlannedAction } from "./PlannerModels";
import { ValidationIssue, ValidationReport } from "./ValidationReport";

export class PlanValidator {

    public validate(
        actions: PlannedAction[]
    ): ValidationReport {

        const issues: ValidationIssue[] = [];

        if (actions.length === 0) {
            issues.push({
                rule: "NonEmptyPlan",
                message: "Plan contains no actions.",
                severity: "Medium"
            });
        }

        for (const action of actions) {

            if (!action.filePath?.trim()) {
                issues.push({
                    rule: "FilePath",
                    message: `Action '${action.name}' has no target file path.`,
                    severity: "High"
                });
            }

            if (action.estimatedTokens < 0) {
                issues.push({
                    rule: "EstimatedTokens",
                    message: `Action '${action.name}' has invalid estimated token count.`,
                    severity: "High"
                });
            }

        }

        return {
            isValid: issues.length === 0,
            issues
        };

    }

}

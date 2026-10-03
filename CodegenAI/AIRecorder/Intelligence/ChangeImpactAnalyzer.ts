import { KnowledgeDiff } from "./KnowledgeComparer";

export interface ChangeImpactReport {
    level: "Low" | "Medium" | "High";
    score: number;
    reasons: string[];
}

export class ChangeImpactAnalyzer {

    public analyze(diff: KnowledgeDiff): ChangeImpactReport {

        let score = 0;
        const reasons: string[] = [];

        if (diff.projectFieldsChanged.length > 0) {
            score += diff.projectFieldsChanged.length * 20;
            reasons.push(`Project fields changed: ${diff.projectFieldsChanged.join(", ")}`);
        }

        if (diff.addedModules.length + diff.removedModules.length > 0) {
            score += (diff.addedModules.length + diff.removedModules.length) * 5;
            reasons.push("Module surface changed");
        }

        if (diff.addedExternalPackages.length + diff.removedExternalPackages.length > 0) {
            score += (diff.addedExternalPackages.length + diff.removedExternalPackages.length) * 12;
            reasons.push("External dependency set changed");
        }

        if (diff.addedDependencyFiles.length + diff.removedDependencyFiles.length > 0) {
            score += (diff.addedDependencyFiles.length + diff.removedDependencyFiles.length) * 2;
            reasons.push("Dependency graph file coverage changed");
        }

        if (diff.addedNamingSuffixes.length + diff.removedNamingSuffixes.length > 0) {
            score += (diff.addedNamingSuffixes.length + diff.removedNamingSuffixes.length) * 4;
            reasons.push("Naming suffix conventions changed");
        }

        const normalized =
            Math.min(score, 100);

        const level: "Low" | "Medium" | "High" =
            normalized >= 70
                ? "High"
                : normalized >= 35
                    ? "Medium"
                    : "Low";

        return {
            level,
            score: normalized,
            reasons
        };

    }

}

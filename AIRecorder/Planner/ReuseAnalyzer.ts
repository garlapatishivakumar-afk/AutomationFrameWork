import { PlannedAction } from "./PlannerModels";
import { ReuseCandidate, ReuseResult } from "./ReuseResult";
import { SimilarityComparer } from "./SimilarityComparer";

export class ReuseAnalyzer {

    private readonly comparer =
        new SimilarityComparer();

    public analyze(
        actions: PlannedAction[],
        existingNames: string[]
    ): ReuseResult {

        const reuse: ReuseCandidate[] = [];
        const create: string[] = [];

        for (const action of actions) {

            let bestName = "";
            let bestScore = 0;

            for (const existing of existingNames) {
                const score = this.comparer.compare(action.name, existing);

                if (score > bestScore) {
                    bestScore = score;
                    bestName = existing;
                }
            }

            if (bestScore >= 0.8 && bestName) {
                reuse.push({
                    name: bestName,
                    filePath: action.filePath,
                    score: bestScore
                });
            } else {
                create.push(action.name);
            }

        }

        return {
            reuse,
            create
        };

    }

}

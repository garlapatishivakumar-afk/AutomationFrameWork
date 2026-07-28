import { LearningEntry, LearningSnapshot } from "./LearningModels";

export class FrameworkIndexer {

    public index(
        entries: LearningEntry[]
    ): LearningSnapshot {

        return {
            entries,
            indexedAt: new Date().toISOString()
        };

    }

}

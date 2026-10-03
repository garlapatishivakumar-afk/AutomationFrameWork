import { LearningEntry, LearningSnapshot } from "./LearningModels";
import { MemoryStore } from "./MemoryStore";

export class MemoryEngine {

    private readonly store =
        new MemoryStore();

    public learn(
        entries: LearningEntry[]
    ): LearningSnapshot {

        for (const entry of entries)
            this.store.put(entry);

        return {
            entries: this.store.list(),
            indexedAt: new Date().toISOString()
        };

    }

}

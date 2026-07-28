import { LearningEntry } from "./LearningModels";

export class MemoryStore {

    private readonly memory =
        new Map<string, LearningEntry>();

    public put(
        entry: LearningEntry
    ): void {

        this.memory.set(entry.key, entry);

    }

    public get(
        key: string
    ): LearningEntry | undefined {

        return this.memory.get(key);

    }

    public list(): LearningEntry[] {

        return [...this.memory.values()];

    }

}

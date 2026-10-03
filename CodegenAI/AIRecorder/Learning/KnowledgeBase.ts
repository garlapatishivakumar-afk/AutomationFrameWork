import { LearningEntry } from "./LearningModels";

export class KnowledgeBase {

    private readonly items =
        new Map<string, LearningEntry>();

    public add(entry: LearningEntry): void {

        this.items.set(entry.key, entry);

    }

    public exists(
        key: string
    ): boolean {

        return this.items.has(key);

    }

    public get(key: string): LearningEntry | undefined {

        return this.items.get(key);

    }

    public all(): LearningEntry[] {

        return [...this.items.values()];

    }

    public remove(
        key: string
    ): void {

        this.items.delete(key);

    }

    public clear(): void {

        this.items.clear();

    }

    public size(): number {

        return this.items.size;

    }

    public statistics() {

        return {

            totalEntries:

                this.items.size,

            mostUsed:

                [...this.items.values()]

                    .sort(

                        (a, b) =>

                            b.usageCount -

                            a.usageCount

                    )[0]

        };

    }

}

import { KnowledgeBase } from "./KnowledgeBase";
import { LearningEntry } from "./LearningModels";

export class LearningEngine {

    private readonly knowledgeBase =
        new KnowledgeBase();

    public ingest(
        entries: LearningEntry[]
    ): void {

        for (const entry of entries) {

            const existing =
                this.knowledgeBase.get(entry.key);

            if (existing) {

                existing.usageCount++;

                existing.lastUsed =
                    new Date().toISOString();

            }
            else {

                this.knowledgeBase.add({

                    ...entry,

                    usageCount: 1,

                    lastUsed:
                        new Date().toISOString()

                });

            }

        }

    }

    public getKnowledgeBase(): KnowledgeBase {

        return this.knowledgeBase;

    }

}

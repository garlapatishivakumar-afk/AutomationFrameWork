import { LearningEntry } from "./LearningModels";

export class SemanticSearch {

    private similarity(
        source: string,
        target: string
    ): number {

        const sourceTokens =
            new Set(
                source
                    .toLowerCase()
                    .split(/\W+/)
                    .filter(Boolean)
            );

        const targetTokens =
            new Set(
                target
                    .toLowerCase()
                    .split(/\W+/)
                    .filter(Boolean)
            );

        let overlap = 0;

        for (const token of sourceTokens) {

            if (targetTokens.has(token))
                overlap++;

        }

        return overlap /
            Math.max(
                sourceTokens.size,
                targetTokens.size,
                1
            );

    }

    public search(
        entries: LearningEntry[],
        query: string
    ): LearningEntry[] {

        return entries

            .map(entry => ({

                ...entry,

                score: Math.max(

                    this.similarity(
                        query,
                        entry.key
                    ),

                    this.similarity(
                        query,
                        entry.value
                    )

                )

            }))

            .filter(

                entry =>

                    (entry.score ?? 0) > 0

            )

            .sort(

                (a, b) =>

                    (b.score ?? 0) -
                    (a.score ?? 0)

            );

    }

}
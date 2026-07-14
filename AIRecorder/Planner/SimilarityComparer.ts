export class SimilarityComparer {

    public compare(
        source: string,
        target: string
    ): number {

        if (!source.trim() || !target.trim())
            return 0;

        const sourceTokens =
            new Set(source.toLowerCase().split(/\W+/).filter(Boolean));

        const targetTokens =
            new Set(target.toLowerCase().split(/\W+/).filter(Boolean));

        if (sourceTokens.size === 0 || targetTokens.size === 0)
            return 0;

        let overlap = 0;

        for (const token of sourceTokens) {
            if (targetTokens.has(token))
                overlap++;
        }

        return overlap / Math.max(sourceTokens.size, targetTokens.size);

    }

}

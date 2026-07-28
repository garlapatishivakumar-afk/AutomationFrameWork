import { LearningEntry } from "./LearningModels";

export class ArtifactExtractor {

    public fromContent(
        content: string,
        source: string
    ): LearningEntry[] {

        const now =
            new Date().toISOString();

        const lines = content
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        return lines.map((line, index) => ({
            key: `${source}_${index + 1}`,
            value: line,
            source,
            score: 1,
            usageCount: 1,
            lastUsed: now
        }));

    }

}

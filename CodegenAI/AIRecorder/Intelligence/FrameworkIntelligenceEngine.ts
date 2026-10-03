import {
    FrameworkKnowledgeSnapshot
} from "./FrameworkKnowledgeEngine";
import {
    FrameworkKnowledgeRepository
} from "./FrameworkKnowledgeRepository";
import { FrameworkScanner } from "./FrameworkScanner";
import {
    ChangeImpactAnalyzer,
    ChangeImpactReport
} from "./ChangeImpactAnalyzer";
import {
    KnowledgeComparer,
    KnowledgeDiff
} from "./KnowledgeComparer";
import { VersionedKnowledgeSnapshot } from "./KnowledgeCache";

export interface IntelligenceResult {
    versioned: VersionedKnowledgeSnapshot;
    previousVersion: number | null;
    diff: KnowledgeDiff | null;
    impact: ChangeImpactReport | null;
}

export class FrameworkIntelligenceEngine {

    private readonly scanner =
        new FrameworkScanner();

    private readonly repository =
        new FrameworkKnowledgeRepository();

    private readonly comparer =
        new KnowledgeComparer();

    private readonly impactAnalyzer =
        new ChangeImpactAnalyzer();

    public scanAndAnalyze(rootPath: string): IntelligenceResult {

        const snapshot =
            this.scanner.scan(rootPath);

        return this.ingest(snapshot);

    }

    public ingest(snapshot: FrameworkKnowledgeSnapshot): IntelligenceResult {

        const previous =
            this.repository.latest();

        const versioned =
            this.repository.save(snapshot);

        if (!previous) {

            return {
                versioned,
                previousVersion: null,
                diff: null,
                impact: null
            };

        }

        const diff =
            this.comparer.compare(previous.snapshot, snapshot);

        const impact =
            this.impactAnalyzer.analyze(diff);

        return {
            versioned,
            previousVersion: previous.version,
            diff,
            impact
        };

    }

    public getRepository(): FrameworkKnowledgeRepository {

        return this.repository;

    }

}

import {
    FrameworkKnowledgeSnapshot
} from "./FrameworkKnowledgeEngine";

export interface VersionedKnowledgeSnapshot {
    version: number;
    timestamp: string;
    snapshot: FrameworkKnowledgeSnapshot;
}

export class KnowledgeCache {

    private versions: VersionedKnowledgeSnapshot[] = [];

    public set(snapshot: FrameworkKnowledgeSnapshot): VersionedKnowledgeSnapshot {

        const nextVersion =
            ((this.versions[this.versions.length - 1]?.version) ?? 0) + 1;

        const versioned: VersionedKnowledgeSnapshot = {
            version: nextVersion,
            timestamp: new Date().toISOString(),
            snapshot
        };

        this.versions.push(versioned);

        return versioned;

    }

    public latest(): VersionedKnowledgeSnapshot | null {

        return this.versions[this.versions.length - 1] ?? null;

    }

    public getVersion(version: number): VersionedKnowledgeSnapshot | null {

        return this.versions.find(entry => entry.version === version) ?? null;

    }

    public previous(): VersionedKnowledgeSnapshot | null {

        if (this.versions.length < 2)
            return null;

        return this.versions[this.versions.length - 2] ?? null;

    }

    public all(): VersionedKnowledgeSnapshot[] {

        return [...this.versions];

    }

    public clear(): void {

        this.versions = [];

    }

}

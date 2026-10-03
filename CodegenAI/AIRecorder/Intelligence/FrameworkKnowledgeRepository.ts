import {
    FrameworkKnowledgeSnapshot
} from "./FrameworkKnowledgeEngine";
import {
    KnowledgeCache,
    VersionedKnowledgeSnapshot
} from "./KnowledgeCache";

export class FrameworkKnowledgeRepository {

    private readonly cache =
        new KnowledgeCache();

    public save(snapshot: FrameworkKnowledgeSnapshot): VersionedKnowledgeSnapshot {

        return this.cache.set(snapshot);

    }

    public latest(): VersionedKnowledgeSnapshot | null {

        return this.cache.latest();

    }

    public previous(): VersionedKnowledgeSnapshot | null {

        return this.cache.previous();

    }

    public get(version: number): VersionedKnowledgeSnapshot | null {

        return this.cache.getVersion(version);

    }

    public history(): VersionedKnowledgeSnapshot[] {

        return this.cache.all();

    }

    public clear(): void {

        this.cache.clear();

    }

}

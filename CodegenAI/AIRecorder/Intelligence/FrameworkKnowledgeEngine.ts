import {
    DependencyKnowledge,
    createEmptyDependencyKnowledge
} from "./DependencyKnowledge";
import {
    NamingKnowledge,
    createEmptyNamingKnowledge
} from "./NamingKnowledge";
import {
    ProjectKnowledge,
    createEmptyProjectKnowledge
} from "./ProjectKnowledge";

export interface FrameworkKnowledgeSnapshot {
    project: ProjectKnowledge;
    dependencies: DependencyKnowledge;
    naming: NamingKnowledge;
}

export class FrameworkKnowledgeEngine {

    private snapshot: FrameworkKnowledgeSnapshot;

    public constructor(initial?: Partial<FrameworkKnowledgeSnapshot>) {

        this.snapshot = {
            project: createEmptyProjectKnowledge(),
            dependencies: createEmptyDependencyKnowledge(),
            naming: createEmptyNamingKnowledge(),
            ...initial
        };

    }

    public update(snapshot: Partial<FrameworkKnowledgeSnapshot>): void {

        this.snapshot = {
            ...this.snapshot,
            ...snapshot
        };

    }

    public getSnapshot(): FrameworkKnowledgeSnapshot {

        return this.snapshot;

    }

}

import {
    FrameworkKnowledgeSnapshot
} from "./FrameworkKnowledgeEngine";

export interface KnowledgeDiff {
    projectChanged: boolean;
    projectFieldsChanged: string[];
    addedModules: string[];
    removedModules: string[];
    addedExternalPackages: string[];
    removedExternalPackages: string[];
    addedDependencyFiles: string[];
    removedDependencyFiles: string[];
    addedNamingSuffixes: string[];
    removedNamingSuffixes: string[];
    hasChanges: boolean;
}

export class KnowledgeComparer {

    public compare(
        previous: FrameworkKnowledgeSnapshot,
        current: FrameworkKnowledgeSnapshot
    ): KnowledgeDiff {

        const projectFieldsChanged =
            this.projectFieldChanges(previous, current);

        const addedModules =
            this.added(previous.project.modules, current.project.modules);

        const removedModules =
            this.removed(previous.project.modules, current.project.modules);

        const addedExternalPackages =
            this.added(
                previous.dependencies.externalPackages,
                current.dependencies.externalPackages
            );

        const removedExternalPackages =
            this.removed(
                previous.dependencies.externalPackages,
                current.dependencies.externalPackages
            );

        const previousFiles =
            Object.keys(previous.dependencies.byFile);

        const currentFiles =
            Object.keys(current.dependencies.byFile);

        const addedDependencyFiles =
            this.added(previousFiles, currentFiles);

        const removedDependencyFiles =
            this.removed(previousFiles, currentFiles);

        const addedNamingSuffixes =
            this.added(
                previous.naming.reservedSuffixes,
                current.naming.reservedSuffixes
            );

        const removedNamingSuffixes =
            this.removed(
                previous.naming.reservedSuffixes,
                current.naming.reservedSuffixes
            );

        const hasChanges =
            projectFieldsChanged.length > 0 ||
            addedModules.length > 0 ||
            removedModules.length > 0 ||
            addedExternalPackages.length > 0 ||
            removedExternalPackages.length > 0 ||
            addedDependencyFiles.length > 0 ||
            removedDependencyFiles.length > 0 ||
            addedNamingSuffixes.length > 0 ||
            removedNamingSuffixes.length > 0;

        return {
            projectChanged: projectFieldsChanged.length > 0,
            projectFieldsChanged,
            addedModules,
            removedModules,
            addedExternalPackages,
            removedExternalPackages,
            addedDependencyFiles,
            removedDependencyFiles,
            addedNamingSuffixes,
            removedNamingSuffixes,
            hasChanges
        };

    }

    private projectFieldChanges(
        previous: FrameworkKnowledgeSnapshot,
        current: FrameworkKnowledgeSnapshot
    ): string[] {

        const changed: string[] = [];

        if (previous.project.rootPath !== current.project.rootPath)
            changed.push("rootPath");

        if (previous.project.framework !== current.project.framework)
            changed.push("framework");

        if (previous.project.language !== current.project.language)
            changed.push("language");

        return changed;

    }

    private added(previous: string[], current: string[]): string[] {

        const set =
            new Set(previous);

        return current.filter(item => !set.has(item)).sort();

    }

    private removed(previous: string[], current: string[]): string[] {

        const set =
            new Set(current);

        return previous.filter(item => !set.has(item)).sort();

    }

}

export interface DependencyKnowledge {
    byFile: Record<string, string[]>;
    externalPackages: string[];
    circularDependencies: string[];
}

export function createEmptyDependencyKnowledge(): DependencyKnowledge {

    return {
        byFile: {},
        externalPackages: [],
        circularDependencies: []
    };

}

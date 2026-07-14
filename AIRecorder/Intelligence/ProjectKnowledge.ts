export interface ProjectKnowledge {
    rootPath: string;
    framework: string;
    language: string;
    modules: string[];
}

export function createEmptyProjectKnowledge(): ProjectKnowledge {

    return {
        rootPath: "",
        framework: "",
        language: "",
        modules: []
    };

}

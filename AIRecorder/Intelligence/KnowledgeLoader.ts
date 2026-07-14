import {
    DependencyKnowledge,
    createEmptyDependencyKnowledge
} from "./DependencyKnowledge";
import {
    FrameworkKnowledgeSnapshot
} from "./FrameworkKnowledgeEngine";
import {
    NamingKnowledge,
    createEmptyNamingKnowledge
} from "./NamingKnowledge";
import { ProjectIndexer } from "./ProjectIndexer";

export class KnowledgeLoader {

    private readonly projectIndexer =
        new ProjectIndexer();

    public load(
        rootPath: string,
        files: string[]
    ): FrameworkKnowledgeSnapshot {

        const normalizedFiles =
            files.map(file => file.replace(/\\/g, "/"));

        const project =
            this.buildProjectKnowledge(rootPath, normalizedFiles);

        const dependencies =
            this.buildDependencyKnowledge(normalizedFiles);

        const naming =
            this.buildNamingKnowledge(normalizedFiles);

        return {
            project,
            dependencies,
            naming
        };

    }

    private buildProjectKnowledge(
        rootPath: string,
        files: string[]
    ) {

        const indexed =
            this.projectIndexer.index(rootPath, files);

        const hasPackageJson =
            files.some(file => file.toLowerCase() === "package.json");

        const hasCsproj =
            files.some(file => file.toLowerCase().endsWith(".csproj"));

        const hasTypeScript =
            files.some(file => file.toLowerCase().endsWith(".ts"));

        const hasCSharp =
            files.some(file => file.toLowerCase().endsWith(".cs"));

        const modules =
            [...new Set(
                files
                    .map(file => file.split("/")[0])
                    .filter(segment =>
                        segment.length > 0 && segment.includes(".") === false
                    )
            )].sort();

        return {
            ...indexed,
            rootPath,
            framework: hasPackageJson ? "node" : (hasCsproj ? "dotnet" : indexed.framework),
            language: hasTypeScript ? "typescript" : (hasCSharp ? "csharp" : indexed.language),
            modules
        };

    }

    private buildDependencyKnowledge(files: string[]): DependencyKnowledge {

        const knowledge =
            createEmptyDependencyKnowledge();

        const byFile: Record<string, string[]> = {};

        for (const file of files)
            byFile[file] = [];

        const external =
            new Set<string>();

        if (files.some(file => file.toLowerCase() === "package.json"))
            external.add("node");

        if (files.some(file => file.toLowerCase().endsWith(".csproj")))
            external.add("dotnet");

        knowledge.byFile = byFile;
        knowledge.externalPackages = [...external].sort();
        knowledge.circularDependencies = [];

        return knowledge;

    }

    private buildNamingKnowledge(files: string[]): NamingKnowledge {

        const knowledge =
            createEmptyNamingKnowledge();

        const suffixes =
            new Set<string>();

        for (const file of files) {

            const name =
                file.split("/").pop() ?? "";

            const baseName =
                name.replace(/\.[^.]+$/, "");

            const detected =
                this.extractKnownSuffix(baseName);

            if (detected)
                suffixes.add(detected);

        }

        const orderedSuffixes =
            ["Methods", "Locators", "Steps"].filter(suffix => suffixes.has(suffix));

        knowledge.conventions = {
            Method: "Methods"
        };
        knowledge.reservedPrefixes = [];
        knowledge.reservedSuffixes = orderedSuffixes;

        return knowledge;

    }

    private extractKnownSuffix(value: string): string | null {

        const candidates = ["Methods", "Locators", "Steps"];

        for (const candidate of candidates) {

            if (value.endsWith(candidate))
                return candidate;

        }

        return null;

    }

}

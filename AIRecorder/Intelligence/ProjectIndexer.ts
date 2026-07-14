import { ProjectKnowledge } from "./ProjectKnowledge";

export class ProjectIndexer {

    public index(
        rootPath: string,
        files: string[]
    ): ProjectKnowledge {

        const language = this.detectLanguage(files);

        return {
            rootPath,
            framework: this.detectFramework(files),
            language,
            modules: this.inferModules(files)
        };

    }

    private detectFramework(files: string[]): string {

        if (files.some(file => file.endsWith(".csproj")))
            return "dotnet";

        if (files.some(file => file === "package.json"))
            return "node";

        return "unknown";

    }

    private detectLanguage(files: string[]): string {

        if (files.some(file => file.endsWith(".cs")))
            return "csharp";

        if (files.some(file => file.endsWith(".ts")))
            return "typescript";

        return "unknown";

    }

    private inferModules(files: string[]): string[] {

        const modules =
            new Set<string>();

        for (const file of files) {

            const segment =
                file.split(/[\\/]/)[0];

            if (segment)
                modules.add(segment);

        }

        return [...modules].sort();

    }

}

import fs from "fs";
import path from "path";
import { DependencyAnalyzer } from "./DependencyAnalyzer";
import {
    FrameworkKnowledgeSnapshot
} from "./FrameworkKnowledgeEngine";
import { NamingConventionAnalyzer } from "./NamingConventionAnalyzer";
import { ProjectIndexer } from "./ProjectIndexer";

export class FrameworkScanner {

    private readonly projectIndexer =
        new ProjectIndexer();

    private readonly dependencyAnalyzer =
        new DependencyAnalyzer();

    private readonly namingAnalyzer =
        new NamingConventionAnalyzer();

    public scan(rootPath: string): FrameworkKnowledgeSnapshot {

        const resolvedRoot =
            path.resolve(rootPath);

        const files =
            this.collectRelativeFiles(resolvedRoot);

        return {
            project: this.projectIndexer.index(resolvedRoot, files),
            dependencies: this.dependencyAnalyzer.analyze(resolvedRoot),
            naming: this.namingAnalyzer.analyze(resolvedRoot)
        };

    }

    private collectRelativeFiles(rootPath: string): string[] {

        if (!fs.existsSync(rootPath))
            return [];

        const result: string[] = [];
        const stack: string[] = [rootPath];

        while (stack.length > 0) {

            const current =
                stack.pop();

            if (!current)
                continue;

            const entries =
                fs.readdirSync(current, { withFileTypes: true });

            for (const entry of entries) {

                const fullPath =
                    path.join(current, entry.name);

                if (entry.isDirectory()) {

                    if (["node_modules", "bin", "obj", ".git"].includes(entry.name))
                        continue;

                    stack.push(fullPath);
                    continue;

                }

                result.push(
                    path.relative(rootPath, fullPath).replace(/\\/g, "/")
                );

            }

        }

        return result;

    }

}

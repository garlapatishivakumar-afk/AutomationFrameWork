import fs from "fs";
import path from "path";
import {
    DependencyKnowledge,
    createEmptyDependencyKnowledge
} from "./DependencyKnowledge";

export class DependencyAnalyzer {

    public analyze(rootPath: string): DependencyKnowledge {

        const files =
            this.collectFiles(rootPath);

        const byFile: Record<string, string[]> = {};
        const externalPackages =
            new Set<string>();

        for (const absolutePath of files) {

            const relativePath =
                this.normalize(
                    path.relative(rootPath, absolutePath)
                );

            const content =
                fs.readFileSync(absolutePath, "utf8");

            const imports =
                this.extractImports(content);

            const localDependencies: string[] = [];

            for (const reference of imports) {

                if (reference.startsWith(".") || reference.startsWith("/")) {

                    const resolved =
                        this.resolveLocalReference(
                            absolutePath,
                            reference,
                            files,
                            rootPath
                        );

                    if (resolved)
                        localDependencies.push(resolved);

                    continue;

                }

                externalPackages.add(
                    this.getExternalPackageName(reference)
                );

            }

            byFile[relativePath] =
                [...new Set(localDependencies)].sort();

        }

        const knowledge =
            createEmptyDependencyKnowledge();

        knowledge.byFile = byFile;
        knowledge.externalPackages =
            [...externalPackages].sort();
        knowledge.circularDependencies =
            this.detectCircularDependencies(byFile);

        return knowledge;

    }

    private collectFiles(rootPath: string): string[] {

        if (!fs.existsSync(rootPath))
            return [];

        const results: string[] = [];
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

                    if (this.shouldSkipDirectory(entry.name))
                        continue;

                    stack.push(fullPath);
                    continue;

                }

                if (this.isCodeFile(entry.name))
                    results.push(fullPath);

            }

        }

        return results;

    }

    private shouldSkipDirectory(name: string): boolean {

        return ["node_modules", "bin", "obj", ".git"].includes(name);

    }

    private isCodeFile(fileName: string): boolean {

        return [".ts", ".tsx", ".js", ".jsx", ".cs"].some(ext =>
            fileName.endsWith(ext)
        );

    }

    private extractImports(content: string): string[] {

        const matches =
            content.matchAll(/(?:import\s+[^\n]*?from\s+["']([^"']+)["'])|(?:require\(\s*["']([^"']+)["']\s*\))/g);

        const imports: string[] = [];

        for (const match of matches) {

            const reference =
                match[1] ?? match[2];

            if (reference)
                imports.push(reference);

        }

        return imports;

    }

    private resolveLocalReference(
        sourceFile: string,
        reference: string,
        allFiles: string[],
        rootPath: string
    ): string | null {

        const sourceDirectory =
            path.dirname(sourceFile);

        const base =
            path.resolve(sourceDirectory, reference);

        const candidates = [
            base,
            `${base}.ts`,
            `${base}.tsx`,
            `${base}.js`,
            `${base}.jsx`,
            `${base}.cs`,
            path.join(base, "index.ts"),
            path.join(base, "index.js")
        ];

        const normalizedFiles =
            new Set(allFiles.map(file => path.normalize(file)));

        for (const candidate of candidates) {

            const normalized =
                path.normalize(candidate);

            if (normalizedFiles.has(normalized))
                return this.normalize(path.relative(rootPath, normalized));

        }

        return null;

    }

    private getExternalPackageName(reference: string): string {

        if (reference.startsWith("@")) {

            const parts =
                reference.split("/");

            return parts.slice(0, 2).join("/");

        }

        return reference.split("/")[0];

    }

    private detectCircularDependencies(
        byFile: Record<string, string[]>
    ): string[] {

        const visited =
            new Set<string>();
        const onStack =
            new Set<string>();
        const cycles =
            new Set<string>();

        const visit = (
            node: string,
            lineage: string[]
        ): void => {

            if (onStack.has(node)) {

                const index =
                    lineage.indexOf(node);

                if (index >= 0) {

                    const cycle =
                        [...lineage.slice(index), node].join(" -> ");

                    cycles.add(cycle);

                }

                return;

            }

            if (visited.has(node))
                return;

            visited.add(node);
            onStack.add(node);

            for (const dependency of byFile[node] ?? [])
                visit(dependency, [...lineage, node]);

            onStack.delete(node);

        };

        for (const filePath of Object.keys(byFile))
            visit(filePath, []);

        return [...cycles].sort();

    }

    private normalize(value: string): string {

        return value.replace(/\\/g, "/");

    }

}

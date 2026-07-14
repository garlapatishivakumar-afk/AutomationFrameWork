import fs from "fs";
import path from "path";
import {
    NamingKnowledge,
    createEmptyNamingKnowledge
} from "./NamingKnowledge";

export class NamingConventionAnalyzer {

    public analyze(rootPath: string): NamingKnowledge {

        const files =
            this.collectFiles(rootPath);

        const methodNames: string[] = [];

        for (const filePath of files) {

            const content =
                fs.readFileSync(filePath, "utf8");

            methodNames.push(
                ...this.extractMethodNames(content)
            );

        }

        const prefixes =
            new Map<string, number>();
        const suffixes =
            new Map<string, number>();

        for (const name of methodNames) {

            const parts =
                name.split(/(?=[A-Z])/).filter(Boolean);

            if (parts.length === 0)
                continue;

            const prefix =
                parts[0].toLowerCase();

            const suffix =
                parts[parts.length - 1].toLowerCase();

            prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
            suffixes.set(suffix, (suffixes.get(suffix) ?? 0) + 1);

        }

        const knowledge =
            createEmptyNamingKnowledge();

        knowledge.conventions = {
            methodCase: this.detectMethodCase(methodNames),
            dominantPrefix: this.findDominant(prefixes),
            dominantSuffix: this.findDominant(suffixes)
        };

        knowledge.reservedPrefixes =
            this.topTerms(prefixes, 10);

        knowledge.reservedSuffixes =
            this.topTerms(suffixes, 10);

        return knowledge;

    }

    private collectFiles(rootPath: string): string[] {

        if (!fs.existsSync(rootPath))
            return [];

        const result: string[] = [];
        const queue: string[] = [rootPath];

        while (queue.length > 0) {

            const current =
                queue.shift();

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

                    queue.push(fullPath);
                    continue;

                }

                if ([".ts", ".tsx", ".js", ".jsx", ".cs"].some(ext => entry.name.endsWith(ext)))
                    result.push(fullPath);

            }

        }

        return result;

    }

    private extractMethodNames(content: string): string[] {

        const names: string[] = [];

        const patterns = [
            /(?:public|private|protected|internal|static|async|virtual|override|sealed|partial|\s)*\s*([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{)]*\)\s*(?:\{|=>)/g,
            /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g
        ];

        for (const pattern of patterns) {

            const matches =
                content.matchAll(pattern);

            for (const match of matches) {

                const name =
                    match[1];

                if (!name)
                    continue;

                if (["if", "for", "while", "switch", "catch"].includes(name))
                    continue;

                names.push(name);

            }

        }

        return names;

    }

    private detectMethodCase(methodNames: string[]): string {

        const pascal =
            methodNames.filter(name => /^[A-Z][A-Za-z0-9]*$/.test(name)).length;

        const camel =
            methodNames.filter(name => /^[a-z][A-Za-z0-9]*$/.test(name)).length;

        if (pascal > camel)
            return "PascalCase";

        if (camel > pascal)
            return "camelCase";

        return "mixed";

    }

    private findDominant(counter: Map<string, number>): string {

        let top = "";
        let max = 0;

        for (const [value, count] of counter.entries()) {

            if (count > max) {
                top = value;
                max = count;
            }

        }

        return top;

    }

    private topTerms(
        counter: Map<string, number>,
        limit: number
    ): string[] {

        return [...counter.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([term]) => term);

    }

}

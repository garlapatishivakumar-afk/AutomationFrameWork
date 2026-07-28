import fs from "fs";
import path from "path";

export type SearchResult = {
    files: string[];
};

function tokenize(text: string): string[] {

    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(x => x.length > 2);
}

function score(text: string, keywords: string[]) {

    const source = text.toLowerCase();

    let total = 0;

    for (const word of keywords) {

        if (source.includes(word))
            total++;
    }

    return total;
}

export function localSearch(

    projectRoot: string,
    recordedFlow: string

): SearchResult {

    const frameworkIndexPath = path.join(
        projectRoot,
        "AIRecorder",
        "FrameworkIndex.json"
    );

    const dependencyGraphPath = path.join(
        projectRoot,
        "AIRecorder",
        "DependencyGraph.json"
    );

    const frameworkIndex = JSON.parse(
        fs.readFileSync(frameworkIndexPath, "utf8")
    );

    const dependencyGraph = JSON.parse(
        fs.readFileSync(dependencyGraphPath, "utf8")
    );

    const keywords = tokenize(recordedFlow);

    const ranked: {

        file: string;
        score: number;

    }[] = [];

    for (const page of Object.keys(frameworkIndex)) {

        const item = frameworkIndex[page];

        const pageScore = score(page, keywords);

        Object.values(item).forEach(file => {

            if (!file)
                return;

            ranked.push({

                file: file as string,

                score: pageScore +
                       score(file as string, keywords)

            });

        });

    }

    ranked.sort((a, b) => b.score - a.score);

    const files = new Set<string>();

    for (const item of ranked.slice(0, 15)) {

        files.add(item.file);

        const deps = dependencyGraph[item.file] || [];

        for (const dep of deps)
            files.add(dep);

    }

    return {

        files: [...files]

    };

}
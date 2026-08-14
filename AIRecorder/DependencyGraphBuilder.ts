import fs from "fs";
import path from "path";

function read(file: string): string {
    return fs.readFileSync(file, "utf8");
}

export function buildDependencyGraph(
    projectRoot: string = process.cwd()
) {

    const pageActionsFolder = path.join(projectRoot, "PageActions");

    const graph: Record<string, string[]> = {};

    if (!fs.existsSync(pageActionsFolder)) {
        console.log("PageActions folder not found.");
        return;
    }

    const helperFolder = path.join(projectRoot, "Helpers");
    const objectFolder = path.join(projectRoot, "PageElements");

    const helperFiles = fs.existsSync(helperFolder)
        ? fs.readdirSync(helperFolder)
        : [];

    const objectFiles = fs.existsSync(objectFolder)
        ? fs.readdirSync(objectFolder)
        : [];

    const methodFiles = fs.readdirSync(pageActionsFolder);

    for (const methodFile of methodFiles) {

        if (!methodFile.endsWith("Methods.cs"))
            continue;

        const fullPath = path.join(pageActionsFolder, methodFile);

        const content = read(fullPath);

        const dependencies = new Set<string>();

        //----------------------------------------------------
        // Detect Page Object usage
        //----------------------------------------------------

        for (const objectFile of objectFiles) {

            const className = objectFile.replace(".cs", "");

            if (content.includes(className)) {

                dependencies.add(
                    path.join("PageElements", objectFile)
                );
            }
        }

        //----------------------------------------------------
        // Detect Helper usage
        //----------------------------------------------------

        for (const helperFile of helperFiles) {

            const className = helperFile.replace(".cs", "");

            if (content.includes(className)) {

                dependencies.add(
                    path.join("Helpers", helperFile)
                );
            }
        }

        graph[path.join("PageActions", methodFile)] =
            [...dependencies];
    }

    const output = path.join(
        projectRoot,
        "AIRecorder",
        "DependencyGraph.json"
    );

    fs.writeFileSync(
        output,
        JSON.stringify(graph, null, 4)
    );

    console.log(
        `Dependency graph generated for ${Object.keys(graph).length} page methods.`
    );
}

// Direct-run check using process argv and __filename — compatible with CommonJS output
const isDirectRun = typeof process !== "undefined" && process.argv && process.argv[1]
    && path.resolve(process.argv[1]) === path.resolve((global as any).__filename || __filename);
if (isDirectRun) {
    buildDependencyGraph();
}
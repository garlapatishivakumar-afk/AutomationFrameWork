import path from "path";
import { FrameworkScanner } from "../Intelligence/FrameworkScanner";
import { KnowledgeCache } from "../Intelligence/KnowledgeCache";

const scanner =
    new FrameworkScanner();

const cache =
    new KnowledgeCache();

const snapshot =
    scanner.scan(
        path.resolve(".")
    );

const versioned =
    cache.set(snapshot);

console.log({
    version: versioned.version,
    timestamp: versioned.timestamp,
    project: snapshot.project,
    dependencyFiles: Object.keys(snapshot.dependencies.byFile).length,
    externalPackages: snapshot.dependencies.externalPackages,
    naming: snapshot.naming
});

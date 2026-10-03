import { IntelligencePipeline } from "./IntelligencePipeline";

const pipeline = new IntelligencePipeline();

// First scan
console.log("===== Scan 1 =====");

const first = pipeline
    .getEngine()
    .ingest({
        project: {
            rootPath: "AutomationFramework",
            framework: "node",
            language: "typescript",
            modules: ["AIRecorder"]
        },
        dependencies: {
            byFile: {},
            externalPackages: ["node"],
            circularDependencies: []
        },
        naming: {
            conventions: {},
            reservedPrefixes: [],
            reservedSuffixes: ["Methods"]
        }
    });

console.log(first);

// Second scan with changes
console.log("===== Scan 2 =====");

const second = pipeline
    .getEngine()
    .ingest({
        project: {
            rootPath: "AutomationFramework",
            framework: "node",
            language: "typescript",
            modules: ["AIRecorder", "Learning"]
        },
        dependencies: {
            byFile: {},
            externalPackages: ["node", "playwright"],
            circularDependencies: []
        },
        naming: {
            conventions: {},
            reservedPrefixes: [],
            reservedSuffixes: ["Methods", "Locators"]
        }
    });

console.log(second);
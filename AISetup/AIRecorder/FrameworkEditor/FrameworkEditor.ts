import { loadFile } from "./FileLoader";
import { saveFile } from "./FileWriter";
import { backupFile } from "./BackupEngine";
import { InsertEngine } from "./InsertEngine";
import { DuplicateDetector } from "./DuplicateDetector";
import { parseFeature } from "./FeatureParser";
import { parseCSharp } from "./CSharpParser";
import { OutputValidator } from "./OutputValidator";
import { EditOperation, EditResult } from "./Models";

const engine =
    new InsertEngine();

const duplicateDetector =
    new DuplicateDetector();

const validator =
    new OutputValidator();

export class FrameworkEditor {

    private extractMethodName(
        source: string
    ): string {

        const match = source.match(
            /(public|private|protected)\s+(?:async\s+)?(?:Task(?:<[^>]+>)?|void|bool|int|string|double|decimal|[A-Za-z0-9_<>,\[\]]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/
        );

        return match?.[2] ?? "";

    }

    private extractLocatorName(
        source: string
    ): string {

        const match = source.match(
            /(ILocator|Locator|IElementHandle)\s+([A-Za-z_][A-Za-z0-9_]*)/
        );

        return match?.[2] ?? "";

    }

    private extractScenarioName(
        source: string
    ): string {

        const match = source.match(
            /^\s*Scenario(?:\s+Outline)?:\s*(.+)$/m
        );

        return match?.[1]?.trim() ?? source.trim();

    }

    apply(
        operations: EditOperation[]
    ): EditResult[] {

        const results: EditResult[] = [];

        for (const op of operations) {

            let content =
                loadFile(op.file);

            let hasDuplicate = false;

            if (
                op.type === "Method"
                || op.type === "Locator"
                || op.type === "Step"
            ) {

                const parsedClass =
                    parseCSharp(content);

                const duplicate =
                    duplicateDetector.checkClass(
                        parsedClass,
                        this.extractMethodName(op.content),
                        this.extractLocatorName(op.content)
                    );

                hasDuplicate =
                    duplicate.hasDuplicate;

            } else if (op.type === "Scenario") {

                const parsedFeature =
                    parseFeature(content);

                const duplicate =
                    duplicateDetector.checkFeature(
                        parsedFeature,
                        this.extractScenarioName(op.content)
                    );

                hasDuplicate =
                    duplicate.hasDuplicate;

            }

            if (hasDuplicate) {

                results.push({

                    success: true,

                    file: op.file,

                    message:
                        "Skipped: Duplicate"

                });

                continue;

            }

            backupFile(op.file);

            switch (op.type) {

    case "Method": {

        const parsed = parseCSharp(content);

        content = engine.insertMethod(
            content,
            parsed,
            op.content
        );

        break;
    }

    case "Locator": {

        const parsed = parseCSharp(content);

        content = engine.insertLocator(
            content,
            parsed,
            op.content
        );

        break;
    }

    case "Step": {

        const parsed = parseCSharp(content);

        content = engine.insertStep(
            content,
            parsed,
            op.content
        );

        break;
    }

    case "Scenario": {

        const parsed = parseFeature(content);

        content = engine.insertScenario(
            content,
            parsed,
            op.content
        );

        break;
    }

}

            const result =
                validator.validate(
                    op.content
                );

            if (!result.success) {

                results.push({

                    success: false,

                    file: op.file,

                    message:
                        JSON.stringify(
                            result.errors
                        )

                });

                continue;

            }

            saveFile(
                op.file,
                content
            );

            results.push({

                success: true,

                file: op.file,

                message: "Updated"

            });

        }

        return results;

    }

}
import { ArtifactGenerationPlan } from "./ArtifactGenerationPlan";

export type SplitArtifactType =
    | "Feature"
    | "Step"
    | "Page"
    | "Locator"
    | "Excel"
    | "Helper"
    | "Config"
    | "Test"
    | "Report";

export interface SplitArtifact {

    type: SplitArtifactType;

    fileName: string;

    content: string;

}

export class ArtifactSplitter {

    public split(
        llmOutput: string,
        plan: ArtifactGenerationPlan
    ): SplitArtifact[] {

        const fromJson =
            this.tryParseJsonArtifacts(llmOutput);

        if (fromJson.length > 0)
            return fromJson;

        const artifacts: SplitArtifact[] = [];

        artifacts.push({
            type: "Feature",
            fileName: `${plan.feature}.feature`,
            content: `Feature: ${plan.feature}\n  Scenario: Auto generated\n    Given generated content`
        });

        for (const step of plan.steps) {
            artifacts.push({
                type: "Step",
                fileName: `${step}.cs`,
                content: `// Auto generated step: ${step}`
            });
        }

        artifacts.push({
            type: "Page",
            fileName: `${plan.page}Page.cs`,
            content: `// Auto generated page: ${plan.page}`
        });

        for (const locator of plan.locators) {
            artifacts.push({
                type: "Locator",
                fileName: `${locator}.cs`,
                content: `// Auto generated locator: ${locator}`
            });
        }

        for (const excel of plan.excel) {
            artifacts.push({
                type: "Excel",
                fileName: `${excel}.xlsx`,
                content: "Auto generated test data"
            });
        }

        for (const helper of plan.helpers) {
            artifacts.push({
                type: "Helper",
                fileName: `${helper}.cs`,
                content: `// Auto generated helper: ${helper}`
            });
        }

        for (const cfg of plan.config) {
            artifacts.push({
                type: "Config",
                fileName: cfg,
                content: "{\n  \"generated\": true\n}"
            });
        }

        for (const test of plan.tests) {
            artifacts.push({
                type: "Test",
                fileName: `${test}.cs`,
                content: `// Auto generated test: ${test}`
            });
        }

        artifacts.push({
            type: "Report",
            fileName: `${plan.feature}_GenerationReport.json`,
            content: JSON.stringify({ generated: true, feature: plan.feature }, null, 2)
        });

        return artifacts;

    }

    private tryParseJsonArtifacts(
        llmOutput: string
    ): SplitArtifact[] {

        try {

            const parsed =
                JSON.parse(llmOutput) as {
                    artifacts?: Array<{
                        artifactType?: string;
                        name?: string;
                        content?: string;
                    }>;
                };

            if (!parsed.artifacts || parsed.artifacts.length === 0)
                return [];

            return parsed.artifacts.map(item => ({
                type: this.mapType(item.artifactType),
                fileName: `${this.safeName(item.name ?? "GeneratedArtifact")}${this.extensionFor(item.artifactType)}`,
                content: item.content ?? ""
            }));

        }
        catch {

            return [];

        }

    }

    private mapType(value?: string): SplitArtifactType {

        switch (value) {
            case "Feature":
                return "Feature";
            case "Step":
            case "Scenario":
                return "Step";
            case "Method":
                return "Page";
            case "Locator":
                return "Locator";
            case "Excel":
                return "Excel";
            case "Helper":
                return "Helper";
            case "Config":
                return "Config";
            case "Test":
                return "Test";
            case "Report":
                return "Report";
            default:
                return "Helper";
        }

    }

    private extensionFor(value?: string): string {

        switch (value) {
            case "Feature":
                return ".feature";
            case "Excel":
                return ".xlsx";
            case "Config":
            case "Report":
                return ".json";
            default:
                return ".cs";
        }

    }

    private safeName(value: string): string {

        return value.replace(/[^A-Za-z0-9_.-]/g, "_");

    }

}

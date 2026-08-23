// V2.1 Enhancement #9 — GenerationReport
// Machine-readable summary of a generation run.
// Reuses token/artifact data from existing pipeline — does not recalculate.

import fs from "fs";
import path from "path";

export interface ArtifactSummary {
    type: string;
    name: string;
    action: "created" | "reused" | "skipped";
    file?: string;
}

export interface SemanticControlSummary {
    locator: string;
    resolvedName?: string;
    controlType: string;
    confidence: number;
    stabilityScore: number;
    isTableControl: boolean;
    warnings: string[];
}

export interface ValidationSummary {
    passed: boolean;
    errors: string[];
    warnings: string[];
}

export interface TokenUsageSummary {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
}

export interface GenerationReportData {
    generatedAt: string;
    branch: string;

    artifacts: ArtifactSummary[];

    semanticControls: SemanticControlSummary[];

    validation: ValidationSummary;

    tokenUsage: TokenUsageSummary;

    knownLimitations: string[];
}

export class GenerationReportBuilder {

    private data: GenerationReportData = {
        generatedAt: new Date().toISOString(),
        branch: "feature/v2.1-intelligence-enhancements",
        artifacts: [],
        semanticControls: [],
        validation: { passed: true, errors: [], warnings: [] },
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        knownLimitations: []
    };

    public addArtifact(artifact: ArtifactSummary): this {
        this.data.artifacts.push(artifact);
        return this;
    }

    public addSemanticControl(ctrl: SemanticControlSummary): this {
        this.data.semanticControls.push(ctrl);
        return this;
    }

    public setValidation(v: ValidationSummary): this {
        this.data.validation = v;
        return this;
    }

    public setTokenUsage(t: TokenUsageSummary): this {
        this.data.tokenUsage = t;
        return this;
    }

    public addLimitation(note: string): this {
        this.data.knownLimitations.push(note);
        return this;
    }

    public build(): GenerationReportData {
        return { ...this.data };
    }

    /** Populate semantic controls from LiveObservations.json if available */
    public loadSemanticControlsFromObservations(projectRoot: string = process.cwd()): this {
        const obsPath = path.join(projectRoot, "AIRecorder", "LiveObservations.json");
        try {
            if (!fs.existsSync(obsPath)) return this;
            const obs = JSON.parse(fs.readFileSync(obsPath, "utf8"));
            for (const o of (obs.observations ?? [])) {
                this.addSemanticControl({
                    locator:       o.locator,
                    resolvedName:  o.resolvedName,
                    controlType:   o.controlType,
                    confidence:    o.confidence,
                    stabilityScore: o.stabilityScore,
                    isTableControl: o.isTableControl,
                    warnings:      o.tableInfo?.rowIndexEvidence
                        ? [`Fragile row index: ${o.tableInfo.rowIndexEvidence}`]
                        : []
                });
            }
        } catch {
            this.addLimitation("Could not load LiveObservations.json for report.");
        }
        return this;
    }

    public save(projectRoot: string = process.cwd()): string {
        const report = this.build();
        const outputPath = path.join(projectRoot, "AIRecorder", "GenerationReport.json");
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
        return outputPath;
    }
}

/** Build and save a default report from available artifacts */
export function buildDefaultReport(projectRoot: string = process.cwd()): string {
    const builder = new GenerationReportBuilder();

    builder
        .loadSemanticControlsFromObservations(projectRoot)
        .addLimitation(
            "Live-browser DOM inspection is not performed. " +
            "Static analysis is used instead (requires authenticated session for live DOM)."
        );

    return builder.save(projectRoot);
}

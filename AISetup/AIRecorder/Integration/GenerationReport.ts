// V2.1 Enhancement #9 — GenerationReport
// Machine-readable summary of a generation run.
// Reuses token/artifact data from existing pipeline — does not recalculate.

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { buildObservations } from "../LiveObserver";
import { buildBusinessFlow } from "../BusinessFlowBuilder";
import { analyzeFlow } from "../FlowAnalyzer";
import { OutputValidator } from "../Validation/OutputValidator";

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

/** Resolve current git branch dynamically. Returns empty string if unavailable. */
function resolveCurrentBranch(): string {
    try {
        return execSync("git branch --show-current", { encoding: "utf8", stdio: ["pipe","pipe","pipe"] }).trim();
    } catch {
        return "";
    }
}

export class GenerationReportBuilder {

    private data: GenerationReportData = {
        generatedAt: new Date().toISOString(),
        branch: resolveCurrentBranch(),
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

/**
 * Build and save a report from the actual V2.1 pipeline:
 *   LiveObserver → observations → business flow → validation → report
 */
export function buildPipelineReport(projectRoot: string = process.cwd()): string {
    const builder = new GenerationReportBuilder();

    // 1. Load semantic controls from LiveObservations
    builder.loadSemanticControlsFromObservations(projectRoot);

    // 2. Build business flow (uses canonicalLocator resolution)
    try {
        const flow = analyzeFlow(projectRoot);
        const steps = buildBusinessFlow(flow, projectRoot);
        for (const step of steps) {
            builder.addArtifact({
                type: "BusinessStep",
                name: step.businessAction,
                action: step.semanticLabel ? "reused" : "created"
            });
        }
    } catch {
        builder.addLimitation("Business flow could not be analyzed (code.ts may be missing).");
    }

    // 3. Validate generated code samples found in LiveObservations context
    const validator = new OutputValidator();
    const obsPath = path.join(projectRoot, "AIRecorder", "LiveObservations.json");
    let validationPassed = true;
    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];

    try {
        if (fs.existsSync(obsPath)) {
            const obs = JSON.parse(fs.readFileSync(obsPath, "utf8"));
            // Validate each observation's playwright action for locator quality
            const sampleCode = (obs.observations ?? [])
                .map((o: { playwrightAction?: string }) => o.playwrightAction ?? "")
                .join("\n");

            if (sampleCode.trim()) {
                const result = validator.validate(sampleCode);
                validationPassed = result.success;
                validationErrors.push(...result.errors.map((e) => e.message));
                validationWarnings.push(...(result.warnings ?? []).map((w) => w.message));
            }
        }
    } catch {
        builder.addLimitation("Validation could not run against observations.");
    }

    builder.setValidation({
        passed: validationPassed,
        errors: validationErrors,
        warnings: validationWarnings
    });

    // 4. Known limitations
    builder.addLimitation(
        "Live-browser DOM inspection is not performed. " +
        "Static analysis is used (requires authenticated session for live DOM)."
    );

    return builder.save(projectRoot);
}

/** @deprecated Use buildPipelineReport instead */
export function buildDefaultReport(projectRoot: string = process.cwd()): string {
    return buildPipelineReport(projectRoot);
}

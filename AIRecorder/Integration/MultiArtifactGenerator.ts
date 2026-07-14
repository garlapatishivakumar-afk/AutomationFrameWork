import crypto from "crypto";
import path from "path";
import { GenerationSummary } from "../Generator/GenerationSummary";
import { ArtifactGenerationPlan } from "./ArtifactGenerationPlan";
import { ArtifactManifest } from "./ArtifactManifest";
import { ArtifactSplitter } from "./ArtifactSplitter";
import { ArtifactWriter } from "./ArtifactWriter";
import { GenerationHistory } from "./GenerationHistory";
import { GenerationSession } from "./GenerationSession";

export interface MultiArtifactGenerationInput {

    request: string;

    projectRoot: string;

    prompt: string;

    llmResult: string;

    provider: string;

    model: string;

    totalTokens: number;

    latencyMs: number;

    plan: ArtifactGenerationPlan;

}

export interface MultiArtifactGenerationOutput {

    manifest: ArtifactManifest;

    session: GenerationSession;

    summary: GenerationSummary;

}

export class MultiArtifactGenerator {

    private readonly splitter =
        new ArtifactSplitter();

    private readonly writer =
        new ArtifactWriter();

    private readonly history =
        new GenerationHistory();

    public generate(
        input: MultiArtifactGenerationInput
    ): MultiArtifactGenerationOutput {

        const artifacts =
            this.splitter.split(
                input.llmResult,
                input.plan
            );

        const projectRoot =
            path.resolve(input.projectRoot);

        const files =
            this.writer.write(projectRoot, artifacts);

        const createdTime =
            new Date().toISOString();

        const manifest: ArtifactManifest = {
            generatedFiles: files,
            createdTime,
            version: "1.0.0",
            provider: input.provider,
            promptHash: this.hash(input.prompt),
            tokens: input.totalTokens,
            latencyMs: input.latencyMs
        };

        const session: GenerationSession = {
            request: input.request,
            prompt: input.prompt,
            llmResult: input.llmResult,
            files,
            metrics: {
                provider: input.provider,
                model: input.model,
                totalTokens: input.totalTokens,
                latencyMs: input.latencyMs
            },
            errors: [],
            createdAt: createdTime
        };

        this.history.add(session);

        return {
            manifest,
            session,
            summary: {
                totalRequested: artifacts.length,
                totalGenerated: artifacts.length,
                totalValidated: artifacts.length,
                totalIntegrated: files.length,
                notes: [
                    `historySize=${this.history.size()}`,
                    `provider=${input.provider}`
                ]
            }
        };

    }

    public getHistory(): GenerationHistory {

        return this.history;

    }

    private hash(text: string): string {

        return crypto
            .createHash("sha256")
            .update(text)
            .digest("hex");

    }

}

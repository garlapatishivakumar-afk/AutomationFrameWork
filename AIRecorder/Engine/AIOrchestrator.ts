import { ArtifactProcessor } from "../ArtifactProcessor";
import { buildBusinessFlow, BusinessStep } from "../BusinessFlowBuilder";
import { buildPromptContext, BuiltContext } from "../ContextBuilder";
import { DecisionEngine, DecisionPlan } from "../DecisionEngine";
import { analyzeFlow, FlowAnalysis } from "../FlowAnalyzer";
import { AIArtifact } from "../Models/AIArtifact";
import { AIResponse } from "../Models/AIResponse";
import { buildPlan, PlanningResult } from "../PlanningEngine";
import { buildFinalPrompt, BuiltPrompt } from "../PromptBuilder";
import type { AIProvider } from "../Providers/AIProvider";
import { OpenAIProvider } from "../Providers/OpenAIProvider";
import { parseAIResponse } from "../ResponseParser";

export type OrchestratorRequest = {
	instruction: string;
	explicitPages?: string[];
	applyArtifacts?: boolean;
};

export type ValidationResult = {
	valid: boolean;
	errors: string[];
};

export type OrchestratorResult = {
	flow: FlowAnalysis;
	businessFlow: BusinessStep[];
	planning: PlanningResult;
	context: BuiltContext;
	decision: DecisionPlan;
	prompt: BuiltPrompt;
	response: string;
	parsed: AIResponse;
	validation: ValidationResult;
	applied: boolean;
};

export class AIOrchestrator {

	private provider: AIProvider;

	private artifactProcessor =
		new ArtifactProcessor();

	private decisionEngine =
		new DecisionEngine();

	constructor(provider?: AIProvider) {

		this.provider = provider || new OpenAIProvider();

	}

	public analyzeFlow(
		projectRoot: string = process.cwd()
	): FlowAnalysis {

		return analyzeFlow(projectRoot);

	}

	public buildContext(
		explicitPages: string[] = [],
		projectRoot: string = process.cwd()
	): BuiltContext {

		return buildPromptContext(projectRoot, {
			explicitPages
		});

	}

	public makeDecision(
		instruction: string,
		explicitPages: string[] = [],
		projectRoot: string = process.cwd()
	): DecisionPlan {

		return this.decisionEngine.buildPlan(
			instruction,
			explicitPages,
			projectRoot
		);

	}

	public buildPrompt(
		instruction: string,
		explicitPages: string[] = [],
		decisionPlan?: DecisionPlan
	): BuiltPrompt {

		return buildFinalPrompt(
			instruction,
			{
				explicitPages,
				decisionPlan
			}
		);

	}

	public async generateArtifacts(
		prompt: string
	): Promise<{ response: string; parsed: AIResponse }> {

		const response = await this.provider.generate(prompt);
		const parsed = parseAIResponse(response);

		return {
			response,
			parsed
		};

	}

	public applyArtifacts(
		artifacts: AIArtifact[]
	): void {

		this.artifactProcessor.process(artifacts);

	}

	public validate(
		parsed: AIResponse
	): ValidationResult {

		const errors: string[] = [];

		if (!parsed || typeof parsed !== "object") {
			errors.push("Parsed response is empty.");
		}

		if (!parsed.summary || typeof parsed.summary !== "string") {
			errors.push("Missing or invalid summary.");
		}

		if (!Array.isArray(parsed.artifacts)) {
			errors.push("Artifacts must be an array.");
		}

		for (const artifact of parsed.artifacts || []) {

			if (!artifact.artifactType)
				errors.push("Artifact missing artifactType.");

			if (!artifact.targetFile)
				errors.push("Artifact missing targetFile.");

			if (!artifact.name)
				errors.push("Artifact missing name.");

			if (typeof artifact.content !== "string")
				errors.push("Artifact content must be a string.");
		}

		return {
			valid: errors.length === 0,
			errors
		};

	}

	public async execute(
		request: OrchestratorRequest
	): Promise<OrchestratorResult> {

		const explicitPages = request.explicitPages || [];

		const flow = this.analyzeFlow();
		const businessFlow = buildBusinessFlow(flow);
		const planning = buildPlan(businessFlow);
		const context = this.buildContext(explicitPages);
		const decision = this.makeDecision(request.instruction, explicitPages);
		const prompt = this.buildPrompt(request.instruction, explicitPages, decision);
		const generation = await this.generateArtifacts(prompt.prompt);
		const validation = this.validate(generation.parsed);

		let applied = false;

		if (validation.valid && (request.applyArtifacts ?? true)) {
			this.applyArtifacts(generation.parsed.artifacts);
			applied = true;
		}

		return {
			flow,
			businessFlow,
			planning,
			context,
			decision,
			prompt,
			response: generation.response,
			parsed: generation.parsed,
			validation,
			applied
		};

	}

}

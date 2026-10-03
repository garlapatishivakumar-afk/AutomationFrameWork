const { buildDebugPrompt, validateAnalysisResponse } = require("./DebugPromptBuilder.cjs");
const { completeLLMRequest, resolveLLMConfiguration } = require("../Integration/OpenAIClientCore.cjs");

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function buildDeterministicAnalysis(classification, proposal, browserEvidence, fallbackReason) {
  return {
    analysisMode: "deterministic",
    provider: null,
    model: null,
    fallbackUsed: true,
    fallbackReason,
    classification,
    rootCause: {
      summary: classification.reason,
      evidence: browserEvidence && browserEvidence.applicationError && browserEvidence.applicationError.indicators.length
        ? browserEvidence.applicationError.indicators
        : [classification.recommendedAction]
    },
    proposedFix: proposal || null,
    confidence: proposal && typeof proposal.confidence === "number" ? proposal.confidence : classification.confidence,
    validationPlan: {
      steps: [
        "Validate the proposal against captured browser and source evidence.",
        "Compile the generated source when an apply step is approved.",
        "Rerun the failed test command and compare the result."
      ]
    },
    requiresHumanApproval: true
  };
}

function normalizeAiProposal(proposedFix, failure, fallbackProposal) {
  if (!proposedFix || typeof proposedFix !== "object") {
    return fallbackProposal;
  }

  const safeFile = proposedFix.file || failure.sourceFile;
  if (safeFile && failure.sourceFile && safeFile !== failure.sourceFile) {
    return null;
  }

  return {
    file: failure.sourceFile,
    line: Number(proposedFix.sourceLine || proposedFix.line || failure.sourceLine),
    location: `line ${Number(proposedFix.sourceLine || proposedFix.line || failure.sourceLine)}`,
    changeType: proposedFix.type || proposedFix.changeType || (fallbackProposal ? fallbackProposal.changeType : "ManualReview"),
    oldCode: proposedFix.oldCode ?? failure.sourceLineText,
    newCode: proposedFix.newCode ?? (fallbackProposal ? fallbackProposal.newCode : failure.sourceLineText),
    reason: proposedFix.reason || (fallbackProposal ? fallbackProposal.reason : "AI proposal"),
    confidence: typeof proposedFix.confidence === "number" ? proposedFix.confidence : (fallbackProposal ? fallbackProposal.confidence : 0.5),
    expectedEffect: proposedFix.expectedEffect || (fallbackProposal ? fallbackProposal.expectedEffect : "AI proposed targeted repair."),
    safeToApply: fallbackProposal ? fallbackProposal.safeToApply : false
  };
}

async function analyzeWithAI(context) {
  const prompt = buildDebugPrompt(context.failure, context.classification, context.previousFixes || []);
  if (context.disableAI) {
    return {
      prompt,
      analysis: buildDeterministicAnalysis(context.classification, context.deterministicProposal, context.browserEvidence, "AI usage disabled for this run."),
      proposal: context.deterministicProposal,
      tokenUsage: {
        promptTokens: prompt.estimatedTokens,
        completionTokens: 0,
        totalTokens: prompt.estimatedTokens,
        estimated: true
      }
    };
  }

  const llmRequest = {
    prompt: prompt.prompt,
    model: (context.aiConfiguration && context.aiConfiguration.model) || resolveLLMConfiguration(context.aiConfiguration).model,
    temperature: (context.aiConfiguration && context.aiConfiguration.temperature) || 0.1,
    maxTokens: (context.aiConfiguration && context.aiConfiguration.maxTokens) || 1200
  };

  try {
    const response = context.aiClient
      ? { available: true, provider: context.aiConfiguration?.provider || "Mock", model: context.aiConfiguration?.model || "mock-model", result: await context.aiClient.complete(llmRequest) }
      : await completeLLMRequest(llmRequest, context.aiConfiguration || {});

    if (!response.available) {
      return {
        prompt,
        analysis: buildDeterministicAnalysis(context.classification, context.deterministicProposal, context.browserEvidence, response.reason),
        proposal: context.deterministicProposal,
        tokenUsage: {
          promptTokens: prompt.estimatedTokens,
          completionTokens: 0,
          totalTokens: prompt.estimatedTokens,
          estimated: true
        }
      };
    }

    const parsed = validateAnalysisResponse(response.result.content);
    const proposal = normalizeAiProposal(parsed.proposedFix, context.failure, context.deterministicProposal);
    if (!proposal) {
      return {
        prompt,
        analysis: buildDeterministicAnalysis(context.classification, context.deterministicProposal, context.browserEvidence, "AI proposal targeted an unrelated file."),
        proposal: context.deterministicProposal,
        tokenUsage: {
          promptTokens: Number(response.result.promptTokens || prompt.estimatedTokens),
          completionTokens: Number(response.result.completionTokens || estimateTokens(response.result.content)),
          totalTokens: Number(response.result.totalTokens || (Number(response.result.promptTokens || prompt.estimatedTokens) + Number(response.result.completionTokens || estimateTokens(response.result.content)))),
          estimated: Boolean(response.result.estimated)
        }
      };
    }

    return {
      prompt,
      analysis: {
        analysisMode: "ai",
        provider: response.provider,
        model: response.model,
        fallbackUsed: false,
        fallbackReason: null,
        classification: parsed.classification,
        rootCause: parsed.rootCause,
        proposedFix: proposal,
        confidence: parsed.confidence,
        validationPlan: parsed.validationPlan,
        requiresHumanApproval: parsed.requiresHumanApproval
      },
      proposal,
      tokenUsage: {
        promptTokens: Number(response.result.promptTokens || prompt.estimatedTokens),
        completionTokens: Number(response.result.completionTokens || estimateTokens(response.result.content)),
        totalTokens: Number(response.result.totalTokens || (Number(response.result.promptTokens || prompt.estimatedTokens) + Number(response.result.completionTokens || estimateTokens(response.result.content)))),
        estimated: Boolean(response.result.estimated)
      }
    };
  } catch (error) {
    return {
      prompt,
      analysis: buildDeterministicAnalysis(context.classification, context.deterministicProposal, context.browserEvidence, error instanceof Error ? error.message : String(error)),
      proposal: context.deterministicProposal,
      tokenUsage: {
        promptTokens: prompt.estimatedTokens,
        completionTokens: 0,
        totalTokens: prompt.estimatedTokens,
        estimated: true
      }
    };
  }
}

module.exports = {
  analyzeWithAI,
  buildDeterministicAnalysis
};
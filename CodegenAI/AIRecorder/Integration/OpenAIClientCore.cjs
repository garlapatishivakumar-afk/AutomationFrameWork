const OpenAI = require("openai");
const dotenv = require("dotenv");

dotenv.config();

function toNumber(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function resolveLLMConfiguration(overrides = {}) {
  const provider = overrides.provider || process.env.DEBUG_ENGINE_AI_PROVIDER || process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? "OpenAI" : "OpenAI");

  return {
    provider,
    model:
      overrides.model ||
      process.env.DEBUG_ENGINE_AI_MODEL ||
      (provider === "AzureOpenAI" ? process.env.AZURE_OPENAI_DEPLOYMENT : process.env.OPENAI_MODEL) ||
      "gpt-4o-mini",
    temperature: toNumber(overrides.temperature, toNumber(process.env.DEBUG_ENGINE_AI_TEMPERATURE, 0.1)),
    maxTokens: toNumber(overrides.maxTokens, toNumber(process.env.DEBUG_ENGINE_AI_MAX_TOKENS, 1200))
  };
}

function getProviderAvailability(configuration) {
  if (configuration.provider === "OpenAI") {
    if (!process.env.OPENAI_API_KEY) {
      return { available: false, reason: "OPENAI_API_KEY is not configured." };
    }

    return { available: true };
  }

  if (configuration.provider === "AzureOpenAI") {
    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_DEPLOYMENT) {
      return { available: false, reason: "Azure OpenAI configuration is incomplete." };
    }

    return { available: true };
  }

  return { available: false, reason: `Provider '${configuration.provider}' is not configured for runtime use.` };
}

async function completeOpenAIRequest(request, configuration) {
  const startedAt = Date.now();
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined
  });

  const response = await client.chat.completions.create({
    model: configuration.model,
    messages: [{ role: "user", content: request.prompt }],
    temperature: configuration.temperature,
    max_tokens: configuration.maxTokens,
    response_format: { type: "json_object" }
  });

  const content = response.choices?.[0]?.message?.content ?? "";
  const usage = response.usage || {};
  const promptTokens = Number(usage.prompt_tokens || Math.ceil(request.prompt.length / 4));
  const completionTokens = Number(usage.completion_tokens || Math.ceil(content.length / 4));

  return {
    success: true,
    content,
    model: response.model || configuration.model,
    promptTokens,
    completionTokens,
    totalTokens: Number(usage.total_tokens || (promptTokens + completionTokens)),
    latencyMs: Date.now() - startedAt,
    finishReason: response.choices?.[0]?.finish_reason || "stop",
    estimated: !usage.total_tokens
  };
}

async function completeAzureOpenAIRequest(request, configuration) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-06-01";
  const startedAt = Date.now();

  const response = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.AZURE_OPENAI_API_KEY
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: request.prompt }],
      temperature: configuration.temperature,
      max_tokens: configuration.maxTokens,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`Azure OpenAI request failed with status ${response.status}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content ?? "";
  const usage = json.usage || {};
  const promptTokens = Number(usage.prompt_tokens || Math.ceil(request.prompt.length / 4));
  const completionTokens = Number(usage.completion_tokens || Math.ceil(content.length / 4));

  return {
    success: true,
    content,
    model: json.model || configuration.model,
    promptTokens,
    completionTokens,
    totalTokens: Number(usage.total_tokens || (promptTokens + completionTokens)),
    latencyMs: Date.now() - startedAt,
    finishReason: json.choices?.[0]?.finish_reason || "stop",
    estimated: !usage.total_tokens
  };
}

async function completeLLMRequest(request, configurationOverrides = {}) {
  const configuration = resolveLLMConfiguration(configurationOverrides);
  const availability = getProviderAvailability(configuration);
  if (!availability.available) {
    return {
      available: false,
      provider: configuration.provider,
      model: configuration.model,
      reason: availability.reason
    };
  }

  const startedAt = Date.now();
  const result = configuration.provider === "AzureOpenAI"
    ? await completeAzureOpenAIRequest(request, configuration)
    : await completeOpenAIRequest(request, configuration);

  return {
    available: true,
    provider: configuration.provider,
    model: configuration.model,
    result: {
      ...result,
      latencyMs: result.latencyMs || (Date.now() - startedAt)
    }
  };
}

module.exports = {
  completeLLMRequest,
  getProviderAvailability,
  resolveLLMConfiguration
};
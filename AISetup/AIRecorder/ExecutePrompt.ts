import OpenAI from 'openai';
import { buildFinalPrompt } from './PromptBuilder';
import { TokenUsageLogger } from './Services/TokenUsageLogger';

type CliArgs = {
  task: string;
  pages: string[];
};

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value: string) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : undefined;
}

function parseArgs(): CliArgs {
  const task =
    getArg('task') ||
    'Convert recorded code.ts flow to framework-compatible feature, step definitions, methods, and objects with maximum reuse.';

  const pageCsv = getArg('pages') || '';
  const pages = pageCsv
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    task,
    pages
  };
}

async function run(): Promise<void> {
  const args = parseArgs();
  const built = buildFinalPrompt(args.task, {
    explicitPages: args.pages
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('OPENAI_API_KEY is not set. Prompt was built in memory but not sent.');
    console.log(`Estimated prompt tokens: ${built.estimatedTokens}`);
    console.log(`Detected pages: ${built.detectedPages.join(', ') || 'None'}`);
    console.log(`Included files: ${built.includedFiles.length}`);
    console.log('Prompt preview:');
    console.log(built.prompt.slice(0, 1400));
    return;
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const startedAt = Date.now();

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: built.prompt }],
    temperature: 0.1
  });

  await TokenUsageLogger.logChatUsage({
    operation: 'ExecutePrompt.run',
    model,
    usage: response.usage,
    promptCharacters: built.prompt.length,
    responseId: response.id,
    latencyMs: Date.now() - startedAt
  });

  const content = response.choices?.[0]?.message?.content ?? '';
  console.log(content);
}

run().catch((error) => {
  console.error('Failed to execute prompt:', error instanceof Error ? error.message : error);
  process.exit(1);
});

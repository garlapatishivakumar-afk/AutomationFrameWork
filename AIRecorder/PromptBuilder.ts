import fs from "fs";
import path from "path";
import { buildPromptContext } from './ContextBuilder';
import { DecisionPlan } from "./DecisionEngine";
import { localSearch } from "./LocalSearch";
type PromptBuilderOptions = {
  explicitPages?: string[];
  decisionPlan?: DecisionPlan;
};

export type BuiltPrompt = {
  prompt: string;
  detectedPages: string[];
  includedFiles: string[];
  estimatedTokens: number;
};

function addSection(lines: string[], title: string, content: string): void {
  lines.push(`## ${title}`);
  lines.push(content.trim());
  lines.push('');
}

function summarizeFlowActions(contextResult: ReturnType<typeof buildPromptContext>): string {

  if (!contextResult.flow.actions.length)
    return "No structured actions detected.";

  return contextResult.flow.actions
    .map((action, index) => {
      const details: string[] = [];

      if (action.locator)
        details.push(`locator=${action.locator}`);

      if (action.page)
        details.push(`page=${action.page}`);

      const suffix = details.length ? ` (${details.join(", ")})` : "";
      return `${index + 1}. ${action.type}${suffix}`;
    })
    .join("\n");

}

function readFiles(files: string[]) {

    const text: string[] = [];

    for (const file of files) {

        const absolute = path.join(
            process.cwd(),
            file
        );

        if (!fs.existsSync(absolute))
            continue;

        text.push(

`FILE: ${file}

${fs.readFileSync(absolute,"utf8")}`

        );

    }

    return text.join("\n\n");
}

export function buildFinalPrompt(taskInstruction: string, options: PromptBuilderOptions = {}): BuiltPrompt {
  const contextResult = buildPromptContext(process.cwd(), {
    explicitPages: options.explicitPages
  });
const relevant = localSearch(
    process.cwd(),
    contextResult.recordedFlow
);
  const lines: string[] = [];

  addSection(lines, 'Task', taskInstruction);

addSection(lines, 'Framework', contextResult.framework);

addSection(lines, 'Structured Flow', summarizeFlowActions(contextResult));

addSection(lines, 'Recorded Flow (Supporting)', contextResult.recordedFlow);

addSection(lines, 'DOM', contextResult.dom);

addSection(lines, 'Page Context', contextResult.pageContext);

addSection(
  lines,
  'Relevant Framework Files',
  readFiles(relevant.files)
);

if (options.decisionPlan) {
  const generateLines = options.decisionPlan.toGenerate.length > 0
    ? options.decisionPlan.toGenerate
      .map(x => `- ${x.artifactType}: ${x.name} -> ${x.targetFile}`)
      .join("\n")
    : "- Nothing new required.";

  const reuseLines = options.decisionPlan.toReuseOrSkip.length > 0
    ? options.decisionPlan.toReuseOrSkip
      .map(x => `- ${x.artifactType}: ${x.name} (${x.reason})`)
      .join("\n")
    : "- No reusable matches found.";

  addSection(
    lines,
    "Decision Engine",
`
Generate ONLY these missing fragments:

${generateLines}

Reuse/skip already matched fragments:

${reuseLines}
`
  );
}

addSection(
    lines,
    'Important Rules',
`
You are generating code for an EXISTING automation framework.

Before creating anything:

1. Check the provided Relevant Framework Files.
2. Reuse existing methods and locators whenever possible.
3. Reuse existing step definitions and scenarios whenever possible.

Reuse existing code whenever possible.

DO NOT create:

- duplicate page methods
- duplicate locators
- duplicate helper methods
- duplicate step definitions
- duplicate feature scenarios

Only create new code if nothing suitable already exists.

Strictly follow the Decision Engine section and generate ONLY items listed under missing fragments.

Use helper methods whenever possible.

Read all test data from Excel.

Use async/await.

Never use Thread.Sleep().

Follow the existing Page Object Model framework.
`
);

addSection(
    lines,
    "Output Format",
`
Return ONLY valid JSON.

Do NOT return markdown.

Do NOT use code blocks.

Return this format:

{
  "summary": "",
  "artifacts": [
    {
      "artifactType": "Method",
      "targetFile": "PageActions/LoginMethods.cs",
      "targetClass": "LoginMethods",
      "name": "LoginAsync",
      "content": ""
    }
  ]
}
`
);

  const prompt = lines.join('\n').trim();

  return {
    prompt,
    detectedPages: contextResult.detectedPages,
    includedFiles: contextResult.includedFiles,
    estimatedTokens: Math.ceil(prompt.length / 4)
  };
}

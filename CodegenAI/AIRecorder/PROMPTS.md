# Prompt Ownership Map

Use this file as the single source of truth for prompt selection.

## Default prompt set

1. `FrameworkPrompt.md`
Role: Code rules, framework constraints, reuse policy, URL and assertion policy.

2. `SprintPrompt.md`
Role: Run workflow (Pass 1 plan, Pass 2 implement, Pass 3 build summary).

3. `ImprovementPrompt.md`
Role: Post-execution analysis and recommendation loop.

4. `ExecutePrompt.md`
Role: Build/test execution checklist and artifact capture.

## Specialized prompts (non-default)

- `FeaturePrompt.md`
- `FeatureGenerationPrompt.md`
- `ExcelGenerationPrompt.md`
- `FeatureGenerationPrompt.md`
- `PromptTemplate.md`
- `SelfHealingPrompt.md`
- `TraceAnalysisPrompt.md`

These are optional helpers for targeted scenarios and should not replace the default set for routine sprint generation.

## Rule of precedence

1. `SprintPrompt.md` owns workflow.
2. `FrameworkPrompt.md` owns code-generation rules.
3. If a specialized prompt conflicts with either above, treat the specialized prompt as informational only.
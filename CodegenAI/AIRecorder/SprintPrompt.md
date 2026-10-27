# Sprint generation run

Batch: <Batch>
Feature: <FeatureStem>

Attach this file to agent chat with both values filled in. Paths are relative to
the repository root. This is a plain Markdown run prompt, not an auto-discovered
VS Code slash command. SprintPrompt.md wins on workflow; FrameworkPrompt.md wins
on code rules. Do not commit, switch branches or run tests.

## Pass 1 - plan only; NO WRITES
Read issues[] and reviewRequired for every case. The Pass 1 table must list each
issue for flagged cases and propose one of: re-record, a stable alternative locator
(with evidence), or a TODO assertion. Never copy a flagged locator into generated
code without stating it in the plan, and never claim downstream actions after an
incomplete replay are verified.

Read FrameworkPrompt.md, FrameworkContext.md, all four shared inputs in
CodegenAI/Recordings/<Batch>/, and the DealsCompletionStatus reference files.
Scan current Features, bindings, pages, locators and helpers for actual reuse.
Read Code.ts only for unsupportedActions or a STAGE2A refused case, never as the
default input for generated cases. For every refused case, read its complete named
TS block (stable ID prefix, not old saved line numbers alone) alongside its current
per-case diagnostics and source range in CSharpGenerationReport.json. Report the
unsupported/invalid statement and the surrounding intended flow; do not infer a
partial C# section or silently exclude the case from the plan. GEN001/GEN002,
REC001/REC002 and ID001 are blockers, not permission to invent missing behavior.
For scalar text/equality refusals, propose locator filter hasText plus a locator
assertion only when the recorded intent supports it. GEN003 requires explicit
branch/assertion review. OBS001 means prior runtime evidence is unverified: TLL
origin tags, a successful compile, and an included draft do not prove execution.
If generation exited 1, check source identity before trusting the retained old
report. Exit 2 means only eligible cases were published; include refused cases in
the Pass 1 table and wait for approval before implementing alternatives.
If Batch/Feature is unset or inputs are missing, report it; never substitute silently.
Output ONE table covering ALL manifest cases: ID/tag and scenario title; recorded
flow; steps/methods/locators reused vs new; Excel workbook/sheet/columns/sample data;
expected-result assertions buildable vs TODO; blockers/red flags.
Use manifest `title` (CSV Title/test case name) exactly as the Scenario name,
without an ID prefix; use manifest `id` (CSV TestCaseId) as `@<id>` for that case.
Only those two CSV columns are required. Missing optional expected-result metadata
is not a missing input file; report assertions lacking recorded evidence as TODO.
Compare each
manifest startUrl with the draft's first navigation; flag error pages, title/flow
mismatches, missing login implementations, unsupported actions, incomplete DOM
evidence, volatile locators and configuration gaps. List exact files to append/create.
STOP and wait for explicit approval. Do not create CSV templates or code in Pass 1.

## Pass 2 - only after approval
Implement the approved plan under FrameworkPrompt.md. Recheck files for intervening
changes. Append only; do not rewrite old implementations or the recorded inputs.
If new blockers change the approved plan, stop for approval rather than guessing.

## Pass 3 - build and summary
Run dotnet build on AutomationFrameWork.csproj. Fix errors only in code generated
in this run, never unrelated existing code. Print the FrameworkPrompt summary,
including Assertions needing human input. Do not run tests or application replay;
execution, traces and improvement belong to ExecutePrompt.md and later workflows.
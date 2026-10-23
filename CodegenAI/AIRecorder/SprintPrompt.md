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
Read Code.ts only for unsupportedActions, never as the default input.
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
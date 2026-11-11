# CodegenAI Architecture (v1.3.4 Cleanup)

This document is the single quick reference for active execution flow and module ownership.

## Active entry points

1. Primary interactive and batch flow:
- `CodegenAI/StartCodegen.ps1`

2. Source-driven offline generation:
- `CodegenAI/StartCodegen.ps1 -Generate -BatchName <name>`

3. Source sync after manual TypeScript edits:
- `CodegenAI/StartCodegen.ps1 -Sync -BatchName <name>`

## Active generation pipeline

1. Record and boundary management:
- `CodegenAI/AIRecorder/Generator/SessionRecorder.cjs`

2. Post-processing and locator intelligence:
- `CodegenAI/AIRecorder/Intelligence/LiveObserver.cjs`
- `CodegenAI/AIRecorder/Intelligence/LiveTableLocatorEngine.cjs`
- `CodegenAI/AIRecorder/Intelligence/LocatorValidator.cjs`
- `CodegenAI/AIRecorder/Intelligence/LocatorRepair.cjs`

3. C# generation and publish:
- `CodegenAI/AIRecorder/Generator/CSharpCodeGenerator.cjs`
- `CodegenAI/AIRecorder/Generator/SprintMerger.cjs`
- `CodegenAI/AIRecorder/Generator/BatchGenerator.cjs`
- `CodegenAI/AIRecorder/Generator/SprintSync.cjs`

## Legacy or non-primary orchestrators

These files are not the primary recording entry path:

- `CodegenAI/AIRecorder/AIOrchestrator.ts`
- `CodegenAI/AIRecorder/Engine/AIOrchestrator.ts`
- `CodegenAI/AIRecorder/Integration/AIOrchestrator.ts`

They can be used for targeted experiments or integration scenarios, but cleanup and production behavior should be validated through `StartCodegen.ps1` flow.

## Prompt docs usage map

Use these as follows to avoid overlap:

- `FrameworkPrompt.md`: code standards and framework guardrails
- `SprintPrompt.md`: sprint/batch execution workflow
- `ImprovementPrompt.md`: post-run analysis and improvement loop
- `ExecutePrompt.md`: execution-specific guidance
- Other prompt files: specialized and optional, not default starting point

## URL configuration policy

Default behavior is config-driven:

- `StartCodegen.ps1` uses blank `TargetUrl` by default.
- URL resolves from `Urls.IReport` in root `appsettings.json`.
- `-TargetUrl` remains available only for one-off overrides.

## Change policy for cleanup branch

When adding cleanup changes, prefer:

1. Clarify active vs legacy ownership before refactoring behavior.
2. Keep runtime behavior unchanged unless there is a specific defect.
3. Keep generated/runtime artifacts out of commits.
4. Add or update tests for generator/intelligence behavior changes.

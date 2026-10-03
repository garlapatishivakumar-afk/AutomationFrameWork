# Table Locator Intelligence

## Purpose
Table Locator Intelligence strengthens Playwright codegen locators for table/grid actions while keeping existing non-table behavior unchanged.

## Activation
The layer runs after codegen when `StartCodegen.ps1` is executed and `-SkipTableLocatorPostProcess` is not provided.

Runtime DOM observation runs first unless `-SkipLiveObservation` is provided.

Flow:

1. Playwright codegen writes `CodegenAI/Code.ts`
2. Live observer replays recorded actions and captures compact DOM evidence to `CodegenAI/AIRecorder/LiveObservations.json`
3. Post-process wrapper invokes `AIRecorder/Intelligence/TableLocatorIntelligence.cjs`
4. Engine analyzes table/grid actions and candidates using observed DOM evidence
5. Best locator is selected using stability scoring and ambiguity checks
6. `Code.ts` is normalized
7. Compact metadata is saved to `CodegenAI/AIRecorder/TableLocatorMetadata.json`
8. Prompt context includes metadata for AI generation

## Table/Grid Detection
Table detection uses:

1. Runtime live DOM observation from `LiveObservations.json` (`insideTable`, ancestors, closest table/row/cell)
2. Safe fallback heuristics only when DOM observation is unavailable

If analysis cannot confirm table context, the original codegen locator is preserved.

## Context Captured
Only compact context is captured per action, not full DOM:

1. action line, action type, target text
2. insideTable flag
3. table id/test-id/class when available
4. row id/business value when available
5. column index when available
6. selected strategy, confidence, and candidate scores

## Candidate Strategies
The engine evaluates multiple candidates, for example:

1. `ROLE`
2. `DATA_ATTRIBUTE`
3. `TABLE_ROW_ID`
4. `TABLE_ROW_BUSINESS_VALUE`
5. `TABLE_CELL`
6. `COMPOSITE`

## Stability Scoring
The engine scores each candidate and applies penalties for unstable traits.

Positive examples:

1. stable data attribute
2. stable table relationship
3. stable row-column relationship
4. business identifier signals

Penalty examples:

1. duplicate text ambiguity
2. dynamic generated row ids (for example `__0`, `__5`)

Best candidate is selected only when confidence and score margin exceed fallback thresholds.

## Dynamic Row Handling
Dynamic row ids are penalized. When possible, business-row locators are preferred over row-index patterns.

## Fallback
This feature is best-effort and non-breaking.

If analysis fails or no stronger locator is found, original codegen lines are retained.

Fallback priority:

1. Actual runtime DOM observation
2. Recorded DOM metadata
3. Existing reliable locator information
4. Heuristic inference
5. Original codegen locator

## Debugging
Run with debug logs:

`./StartCodegen.ps1 -TableLocatorDebug`

Typical logs:

1. table/grid element detected
2. candidates generated
3. best strategy and confidence
4. selected locator or fallback decision

## Before/After Example

Before:

`await page.getByRole('link', { name: '891411' }).click();`

After (example):

`await page.locator("//tr[td[normalize-space()='891411']]/td[3]//a[normalize-space()='891411']").click();`

Note: locator shape is dynamically chosen from scored candidates and available context.

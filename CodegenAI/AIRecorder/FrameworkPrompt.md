# Sprint generation code rules

## Inputs and evidence
Read `CodegenAI/Recordings/<Batch>/manifest.json`, `Code.cs`,
`CSharpGenerationReport.json` and `TableLocatorMetadata.json`. Manifest fields:
`id`, `title`, `expectedResult`, `preconditions`, `startUrl`, `dataHint`.
Read `Code.ts` ONLY for `unsupportedActions`, using case/source-line mappings.
Never change recordings. Missing inputs, failed/excluded cases and unsupported
actions are planning blockers. `CodegenFlowTCxx` classes are DRAFTS: extract
locators and ordered flow; never copy draft classes into the project. Generation
success is not runtime verification.

## Architecture and append-only scope
Use Playwright C#, Reqnroll, xUnit and awaited async APIs. Scan actual Features and
bindings; target Feature comes from SprintPrompt, not an interactive picker.
Reference: `Features/DealsCompletionStatus.feature`,
`StepDefinitions/DealsCompletionStatusSteps.cs`, `PageActions/DealsCompletionStatusPage.cs`,
`PageElements/DealsCompletionStatusLocators.cs`. Use `<X>Steps.cs`, `<X>Page.cs`,
`<X>Locators.cs` in those folders: thin steps, separate locators/business actions.
Reuse compatible login/navigation steps, methods and helpers first; check behavior
and URLs. Stubs are not implementations. Append only missing scenarios, bindings,
methods and locators; define shared steps once. Never edit/rename/delete existing
implementations, Hooks or unrelated files. Avoid rerun duplicates; keep CRLF/style.

## Batch and domain names
One Scenario per case, title `<TestCaseId> - <Title>`, tag `@<TestCaseId>` (e.g. @TC01).
Plan ALL cases, including blocked ones. Scenario Outline is allowed only when the
manifest demonstrates identical flow with different data; preserve per-case tags
through separately tagged Examples blocks. Extract repeated subflows and split
long flows into single-purpose methods. Use PascalCase verb-first domain names
ending Async, replacing OpenTargetModuleAsync, ApplySearchCriteriaAsync and
NavigateToApplicationAsync. Flag title/flow disagreements; do not invent intent.

## Configuration and test data
Resolve every URL through appsettings.json and ConfigReader. Reuse exact keys in
`Urls:Applications` via `config.Urls.TryGetApplication(key)`; reject empty values.
Propose meaningful missing keys in the plan; add only approved entries. Never
hardcode URLs. Change ConfigReader only for approved structural additions.
Flag error-page URLs; never substitute another URL without approval.
Read Excel inputs by TestCaseId, not row order. Use
`TestCaseContext.GetTestCaseId(scenarioContext)` and
`new ExcelUtility(workbookPath).ReadByTestCaseId(sheetName, id)`; the latter returns
a case-insensitive Dictionary<string, string>, including blanks. Resolve paths
from the framework project root. Do not edit .xlsx files. In approved implementation
write `DataFiles/Templates/<Batch>_<Feature>.csv`: first line `# Sheet: <SheetName>`,
then TestCaseId/required columns and recorded sample values, correctly CSV-escaped.
Specify workbook/sheet/columns for manual import; omit secrets. No planning writes.
Use CommonActionsPage.FillAsync and SelectDropdownAsync (native select by option
value). Custom dropdowns need recorded interactions. Leave private helpers intact.

## Locators and waits
Reuse locators ONLY on exact expression match, including Exact/position/frame scope;
never partial similarity. Preserve a draft expression verbatim when its locator text
matches same-case table metadata with positive live uniqueness evidence. Match text,
not line number alone; fallback/low-confidence metadata or incomplete replay is not
proof of live validation. A trailing `// [TLL TC01:L21]` (legacy `// [TLL L21]`)
in Code.cs marks a table-engine rewrite and identifies its case/source line; it is
provenance, not proof of live validation. Never copy marker comments into project code.
Otherwise prefer role, label or stable CSS; avoid volatile ctl00 IDs, generated
numeric suffixes and row indexes. Never invent attributes or simplify validated
frame/table scope. Prefer short unique relative XPath if needed; no absolute XPath
or unjustified First/Nth. Unprovable replacements need human evidence, not guesses.
Use visible/hidden/attached waits, loader/grid readiness or a specific response.
No Thread.Sleep, Task.Delay, fixed sleeps or blanket NetworkIdle. Subscribe to popup,
download/response events before triggering actions; preserve event/action order.
Follow FrameworkContext dialog handling. Reuse framework logging/error handling.

## Assertions and summary
Read issues[] and reviewRequired for every case. The Pass 1 table must list each
issue for flagged cases and propose one of: re-record, a stable alternative locator
(with evidence), or a TODO assertion. Never copy a flagged locator into generated
code without stating it in the plan, and never claim downstream actions after an
incomplete replay are verified.

Derive Assertions.Expect checks from each expectedResult using recorded locators
or literal UI text actually specified there. "Confirmation shown" is not exact UI
text. Assert relevant navigation, values/selections, messages and popup/grid states
only with evidence. If no stable locator exists, add the Then binding with
`// TODO(assert): <reason>` and throw NotImplementedException; never silently pass.
Summary: feature; scenarios/tags; steps/methods/locators reused vs
added; URL/config changes; Excel workbook/sheet/columns/CSV; waits/assertions; files
changed; build result; blockers and **Assertions needing human input**.

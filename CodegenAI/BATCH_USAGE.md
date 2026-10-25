# Batch recording: one persistent browser, one output pair per sprint

Run these commands from the `CodegenAI` directory in Windows PowerShell 5.1.
Batch cases are recorded in **one browser session** and then processed separately.
The files to review are the sprint's **Code.ts**, **Code.cs** and **manifest.json**. The existing
single-recording command and paths are unchanged. Generation defaults to tiered
review handling; add `-StrictLocators` for the previous strict failure policy.

## Persistent session boundaries

After the initial launch prompt, record the first CSV case in the browser, then
press **Enter in the terminal** to save its boundary. The browser stays open with
its current pages, cookies and application state. Record the next case and press
Enter again. After the last boundary, **one extra Enter (or `done`) closes the
browser gracefully**. Do not close the browser manually to finish the batch.

- Empty Enter reprompts without advancing. `done` saves a nonempty current case
  and leaves remaining cases planned; an empty current case stays planned.
- `-NoPrompt` suppresses only the initial launch pause. Terminal Enter/`done`
  boundaries are still mandatory; redirected input ending early is a failure.
- The first selected case's configured URL starts the browser. Later `StartUrl`
  values do not cause automatic navigation; navigate manually if the next case
  needs another page. No URL is hardcoded by the recorder.
- Output is written live to the batch Code.ts by **one child Node codegen CLI**.
  Enter waits for a complete single-test AST after an event-driven quiet period
  longer than Playwright's 250 ms output throttle. Pause browser interactions
  while accepting a boundary; this is a file-flush heuristic, not a browser-side
  action-completion acknowledgement.
- Each boundary saves its action-ending line (not the test footer), cumulative
  statement count, per-case count and a full snapshot. Completed source prefixes
  are immutable: Playwright coalescing a later `fill` into a completed case is an
  explicit failure, never silently attributed to the wrong case. Finish editing
  the same input before accepting a boundary. Re-record after reviewing backups.
- Actions after the last boundary, including the shutdown flush, extend the last
  case and are reported as final-tail actions. Nothing is silently discarded.
  A shutdown-flushed action for an empty current case belongs to that current case.
- Popup/download/promise variables declared in a prior case are **blocked for
  isolated generation** when referenced by a later case. Both named blocks and
  snippets remain available for review. Keep dependent actions in one case or
  review/restructure boundaries; the recorder does not invent setup actions.
- Manual early browser close, invalid capture, prefix rewrite, EOF or interruption
  fails the session and attempts graceful cleanup. On failure the prior combined
  source is restored (when present); raw output and completed snapshots remain in
  `.work/session/<run-id>/`. Forced process termination cannot guarantee cleanup.
- Existing shared artifacts and selected working evidence are backed up before
  replan/recording. Backups may contain credentials or private input: treat them
  like recordings, keep them out of source control, and manage retention locally.

On success the recorder returns with ordinary named `test('ID - title', ...)`
blocks, `.work/<id>/Code.ts` snippets with the same headers, recorded statuses,
and boundaries.json. `captureSessions[]` retains raw-file paths, original boundary
counts/lines, snapshot paths and hashes; `cases[]` holds final combined block
positions. Raw provenance lives at the top level so subsequent SprintSync updates
to `cases[]` do not erase capture history. These are capture statement counts,
including variable declarations, not necessarily the generator's action counts.

The existing per-case LiveTable/review/C# pipeline then processes only newly
recorded snippets, with codegen and the live C# watcher disabled. **Normal
recording retains the previous live-observation default**, which replays actions;
use `-SkipLiveObservation` to prevent that replay. Continuation cases do not get
invented navigation/setup and may need review when observed in isolation. The
recorder itself never replays tests. Other table/debug/strict/skip options retain
their existing meaning.

Publication calls the existing SprintMerger build/metadata APIs once, keeps every
recorded TypeScript block (including blocked cases), and remaps metadata and C#
TLL comments to global combined lines. Only eligible cases enter Code.cs. It does
**not** invoke the merger's filtered-Code.ts writer or automatically regenerate
through SprintSync: that would replace the just-produced validator outcomes.
Use explicit offline sync after later source edits. Multi-file publication is not
a filesystem transaction; recovery backups are retained before publication.

### Offline sync from the authoritative combined source

`-Sync -BatchName Sprint12` needs no CSV, application URL resolution, authentication
or browser. It invokes the existing offline SprintSync CLI before any replan.
`-GenerateOnly -BatchName Sprint12` also routes here when boundaries.json exists,
even if `-BatchFile` is supplied. It reads combined Code.ts, **not stale work
snippets**, and never runs live observation or table rewriting. `-StrictLocators`
is forwarded; `-SkipCSharpGeneration` is incompatible. Sync always covers the full
combined source for consistent global mappings, even with `-Only`. Per-case
validation is recomputed under SprintSync's existing evidence/review rules; sync
may refuse a blocked case rather than partially publish. Capture history remains.

For `-Only` re-recording, unselected named blocks are preserved from combined
Code.ts, not reconstructed from old work files. If their working evidence no
longer matches manually edited source, publication refuses stale evidence; run
offline sync before re-recording. Incompatible headers or unknown named blocks
also require review instead of silent replacement.

## Yellow table-locator highlighting

Phase 3 uses the dependency-free, read-only local extension in
[AIRecorder/Extension/TllHighlighter](AIRecorder/Extension/TllHighlighter).
It needs no npm packages, compilation/build step, or network connection.

**What counts as transformed:** in the current TableLocatorMetadata.json schema,
only a non-empty `actions[].locator` identifies a rewrite counted in
`transformedActions`. `tableDetected`, `uniqueMatch`, confidence, candidates and
`analyzedActions` alone do not. `locator` is the generated inner selector, usually
XPath. The engine has an internal full `originalLocator` expression, but does not
persist it or a `generatedLocator` field; the tooltip explicitly reports a missing
original rather than reconstructing one. The table engine is unchanged.

- TypeScript gets **no markers or edits**. The extension verifies the locator at
  metadata's one-based `line`, normalizing syntax whitespace/quote style without
  changing string values. If moved, it picks the nearest verified locator/action
  match (ties choose the earlier line), restricted to the same case in merged files.
  No match means no highlight. Comments, input values and unrelated locators do not count.
- Generated C# properties/statements end with `// [TLL TC01:L21]`, or
  `// [TLL L21]` in legacy mode. The number is the per-case TypeScript source line,
  not the C# line. Shared properties use the first transformed action's provenance;
  other actions using that property are marked only if individually transformed.
  Only complete statement/property lines receive comments; callback wrapper/closing
  lines do not inherit a child action's marker. The merger preserves markers and
  generation-report hashes. Missing/unreadable metadata produces one non-blocking
  console warning and no markers. Existing strict/default policies remain unchanged.
- The extension uses metadata beside the file; legacy CodegenAI/Code.ts falls back
  to AIRecorder/TableLocatorMetadata.json. Merged metadata's `line` is the merged TS
  line; `sourceLine` and `testCaseId` locate the original action for C# hovers.
- Whole lines and the overview ruler are yellow. Hover shows case, source line,
  original/generated locator, strategy, confidence and uniqueMatch. Forced/fallback,
  inferred, low-confidence or absent live-validation provenance gets a visible
  **NOT LIVE-VALIDATED / not established** note. Yellow never overrides failed
  validation, incomplete replay, reviewRequired or missing assertions.
- Setting `tllHighlighter.filePatterns` defaults to `["Code.ts", "Code.cs"]`;
  file-name patterns support `*` and `?`. Editor changes, debounced edits and metadata
  create/change/delete refresh decorations. Read errors clear decorations and log
  a short message in the **TLL Highlighter** Output channel, never metadata contents.

### Try without installing (from the repository root)

```powershell
code --extensionDevelopmentPath=.\CodegenAI\AIRecorder\Extension\TllHighlighter .
```

Open the sprint's Code.ts and Code.cs in that window. Check the yellow lines,
hover text, moved-line behavior, and refresh after offline regeneration yourself;
unit tests and a successful copy do **not** verify VS Code rendering or discovery.
If the earlier prototype `automationframework-local.codegen-tll-highlighter` is
installed, disable it manually while testing to avoid duplicate decorations.

### Install / uninstall (only after visual review)

```powershell
.\CodegenAI\AIRecorder\Extension\TllHighlighter\Install-TllHighlighter.ps1
# Then reload the VS Code window.
.\CodegenAI\AIRecorder\Extension\TllHighlighter\Install-TllHighlighter.ps1 -Uninstall
```

The PowerShell 5.1 script copies this extension into
`%USERPROFILE%\.vscode\extensions\local.tll-highlighter-0.1.0`, replacing **only that
folder**. `-ExtensionsRoot <temporary-directory>` tests installation elsewhere;
use the same root with `-Uninstall` to remove it. Linked destinations and a destination
containing/inside the source folder are rejected. No Marketplace or packaging tool
is needed. Reload after installation/removal; copied-folder discovery needs manual verification.

### Existing recordings and tests

Existing C# drafts need offline regeneration for the new markers. Back up ignored
recordings, and test on a temporary copy first. To retain saved rewritten TypeScript
and its original metadata, use the existing `-GenerateOnly -SkipLiveObservation
-SkipTableLocatorPostProcess` workflow. Do not manually append markers to old drafts:
their report hashes would no longer match. Generation performs no live replay in
this mode. Rerunning the rewrite engine can replace metadata with zero new rewrites;
highlighting reflects that metadata, not a historical cumulative count.

`analyzed=13, transformed=2` means two verified TS action lines, **not 13**. C# can
have more yellow lines because each rewritten action also has a locator property
and potentially a readiness statement. If the current metadata says transformed=0,
zero highlights is correct, regardless of older console output.

```powershell
node --test .\CodegenAI\AIRecorder\Extension\TllHighlighter\*.test.cjs
node --test .\CodegenAI\AIRecorder\Generator\CSharpCodeGenerator.Tll.test.cjs
```

## Test case CSV

Create/edit [testcases.csv](testcases.csv), with only these two column headers.
`Title` is the test case name:

```csv
TestCaseId,Title
TC01,Create inspection order with valid data
TC02,Create inspection order with missing mandatory field
```

`TestCaseId` must be unique (case-insensitive on Windows), match
`^[A-Za-z0-9_-]+$`, and not be a reserved Windows device name. `Title` cannot
be blank or contain newlines (Scenario names must be single-line). Quote names
containing commas. The default start URL comes from `Urls.IReport` in the root
appsettings.json, including files with JSON comments. No URL is hardcoded in the
launcher. Existing `-TargetUrl` overrides and optional legacy CSV columns remain
supported, but are not required.

When including the recorded script in the framework, use `Title` exactly as the
Scenario name and `TestCaseId` as its tag, without prefixing the name with the ID:

```gherkin
@TC01
Scenario: Create inspection order with valid data
```

Both FrameworkPrompt.md and SprintPrompt.md enforce this mapping. The two-column
CSV does not supply expected results: use recorded assertion evidence or flag
missing business expectations for human input rather than inventing assertions.

Combined C# classes are `TestCase<TestCaseId>`; hyphens become underscores.
Internal per-case drafts still use `CodegenFlow<TestCaseId>` so their validated
hashes and generation/fidelity contracts remain unchanged. The combined report's
`className` names the public class; `internalClassName` records the draft class.

### Combined locator layout

Normal session publication, offline SprintSync and direct SprintMerger calls all
emit one namespace-top `public sealed class Locators`. Every generated locator
property is on a single line, preserving shared, case-ID and case-popup ordering.
The Locators class has no comments, headings, property TLL tags or banner above it.
TestCase classes contain actions, not local `ILocator` properties; their banners
and REVIEW REQUIRED comments remain.

- Main-page calls use `_locators = new Locators(Page)` after Page initialization.
- Each popup gets its own bound Locators field immediately after its actual page
  assignment, before locator use. Methods receiving a popup page create a local
  Locators instance from that parameter, rather than reading a stale page field.
- Only identical **full, exact original TS expressions** on the main actor may
  share across cases, and their generated expressions must also match. Different
  raw selector strings remain distinct even when they generate identical C#.
  Popup actors never cross-share. Legacy reports without verified provenance are
  consolidated from declarations but do not cross-share.
- Global naming collisions use deterministic case/actor suffixes. Conflict review
  details and flags remain in reports, but exact selector groups share independently
  of property names: reserve the first existing common name in case/property order
  before suffixing differing definitions, even when a third case uses that name.
  Action-level TLL tags and
  report/metadata lineage retain every origin; property-level comments are omitted
  only from the final combined projection.
- The `sharedLocators` report/API remains the exact-sharing summary, not the total
  number of unified properties. Reference `propertyName` stays the internal name
  for sync comparisons; `emittedPropertyName` identifies the combined property.
- Actions, waits, ReplayAsync ordering, values, URL resolution and existing method
  names are preserved. Unsupported/broken declarations or ambiguous popup binding
  are rejected, never silently dropped. Offline sync retains its combined compile
  gate. The standalone, non-batch generator keeps its legacy output format.

Existing recording artifacts are not automatically rewritten by this format
change; use the normal explicit generation/sync workflow after backing them up.
Each merged TypeScript test is titled `TestCaseId - Title`, with quotes, backslashes
and line breaks escaped. The original per-case recording is not renamed or edited
by the merger.
IDs that would produce colliding class names are rejected before any recording.
`BatchName` also accepts only letters, digits, underscores and hyphens and must
not be a Windows device name. Its default is `yyyyMMdd-HHmmss`.

## Commands

```powershell
.\StartCodegen.ps1 -BatchFile .\testcases.csv -BatchName Sprint12
.\StartCodegen.ps1 -BatchFile .\testcases.csv -BatchName Sprint12 -Only TC03
.\StartCodegen.ps1 -Sync -BatchName Sprint12
.\StartCodegen.ps1 -BatchFile .\testcases.csv -BatchName Sprint12 -GenerateOnly -SkipLiveObservation
.\StartCodegen.ps1 -BatchFile .\testcases.csv -BatchName Sprint12 -GenerateOnly -StrictLocators
.\StartCodegen.ps1 -BatchFile .\testcases.csv -BatchName Demo -DryRun
.\StartCodegen.ps1                       # single recording, tiered review policy
```

Add a `TC03` row to the CSV before using the second command. Multiple IDs can
be selected with `-Only TC01,TC02`. Paths supplied with `-BatchFile` are relative
to the current directory (or absolute).

- Normal recording uses the persistent boundary workflow above. `q` is available
  only at the initial launch pause; use `done` inside the session. There is no
  per-case `s` command; use `-Only` to select cases before launching.
- Saved session validity is checked before the one child launch. The same browser
  remains open throughout; storage is saved at graceful shutdown.
- `-DryRun` validates, prints the plan and writes only a planned manifest inside
  the sprint directory. It does not create `.work`, Code.ts, Code.cs or combined
  reports, update the latest-batch pointer, initialize the session or open a browser.
  Existing output files are not deleted by a dry run; use a fresh name for planning.
- **Legacy batches without boundaries.json:** `-GenerateOnly` runs table rewriting and final C# generation for existing
  recordings, without prompts, session initialization, browser or watcher.
  Live observation is forcibly disabled, even without `-SkipLiveObservation`.
  Input is `.work/<TestCaseId>/Code.ts`, not the merged sprint file. Previously saved
  per-case observations can still be consumed. Missing recordings
  are skipped; recordings without an `await page.` action fail. It cannot be
  combined with `-SkipCSharpGeneration`.
- For legacy regeneration without rewriting recorded TypeScript, also use
  `-SkipTableLocatorPostProcess`. Existing DOM/table evidence remains available.
- C# generation now checks actual emitted action order (`actionFidelity` in each
  case report), including popup/download boundaries. Omitted, duplicated,
  reordered supported actions block publication. Unsupported actions that leave
  compilable C# require review by default and throw NotSupportedException if executed;
  they never silently pass. `-StrictLocators` retains previous unsupported blocking.
  This applies to single recordings too; structural failures do not overwrite good C#.
  Nested iframe chains and `getByAltText` click/fill actions are supported. Conversion
  fidelity does not prove runtime success: a recorded fill still needs an editable
  target, valid session and application state. No business assertion is invented
  from CSV expected-result text.
- DOM observation replays input values (`fill`, `press`, `selectOption` and
  `setInputFiles`) before later clicks. Unsupported or failed replay steps stop
  further observation rather than inspecting a misleading application state.
  Execution failures retain any DOM evidence already captured for that step.
  Reports expose `locatorValidation.observationCoverage`; `INCOMPLETE` means
  downstream locators are **unverified**, not proven valid or invalid. This also
  detects old saved observations that silently omitted recorded inputs. Reliable
  zero/duplicate matches remain FAIL rules: they require review by default and
  block generation with `-StrictLocators`. Offline regeneration does not
  repair the saved evidence or prove the business flow works; a fresh complete
  observation is needed for that. Observation replays actions against the target
  application, so use suitable test data to avoid duplicate business operations.
- `-Only` merges selected entries into an existing manifest and does not touch
  unselected working files. Shared outputs are rebuilt in CSV order with the case
  replaced in place. Reuse `-BatchName` to resume a batch. Without `-Only`,
  a fresh plan is written for every row in the CSV. Dry-run replans selected entries;
  use a separate batch name if you want to preserve their prior statuses.
- Re-recording a selected case backs up and replaces its old TypeScript and DOM/table metadata.
  Failed generation may leave an earlier internal C# file; the manifest status is
  authoritative, and failed/skipped/planned cases are excluded from merged C#.
  Persistent-session TypeScript retains recorded blocked cases.
  Raw recordings are retained on generation failure. A failure on one case does not
  remove successful cases from the sprint outputs.
- For legacy no-boundary regeneration, after every processed case (including failure/skip), and at the end, the merger
  rebuilds all four shared artifacts. Structurally valid cases, including review
  cases, with both outputs and a valid report are included in Code.ts/Code.cs. The report still includes every
  manifest case and its status/diagnostics. Empty merged files mean no eligible cases.
- Malformed TypeScript blocks generation; multiple tests in one working file,
  mismatched class identity or invalid metadata line references fail the merge. Other
  valid cases are still published. Do not append several tests to one internal file.

## Output layout

```text
CodegenAI/
  Recordings/
    latest-batch.txt                 # Recordings/Sprint12 (relative to CodegenAI)
    Sprint12/
      manifest.json
      boundaries.json               # session history + final block positions
      Code.ts                       # one header; TC01, TC02, ... test blocks
      Code.cs                       # shared usings/namespace; one class per case
      CSharpGenerationReport.json   # per-case sections, including failed cases
      TableLocatorMetadata.json     # tagged entries and merged-file line numbers
      .work/                        # INTERNAL: not Phase 2 inputs
        session/<run-id>/            # raw.ts, boundary snapshots, recovery backups
        TC01/
          Code.ts
          Code.cs
          CSharpGenerationReport.json
          TableLocatorMetadata.json
          LiveObservations.json     # only when observation is enabled
        TC02/
          ...same internal artifacts...
```

Persistent batches have no live C# watcher; generation follows session completion.
Legacy single-recording watchers use `.csharp-live-sync.stop` and remove it during
cleanup. Disabled pipeline stages do not create their artifacts.
All CodegenAI C# drafts are excluded from framework compilation. The recording
directory, including `.work`, is excluded from resources/items and git as well.
Case class names avoid collisions within a batch, not between copies of the same
case in different batches. Review output before promoting it into compiled code.

Code.ts takes imports and `test.use` from the first included case once. Every case
retains its own test callback and actions, not a concatenation of browser sessions.
Differing additional imports are rejected; the first included case's `test.use`
settings govern the shared file. C# using directives are deduplicated and all classes
are kept inside the same namespace with their `// Test case:` comments.

Each shared file is written to a temporary file and atomically renamed over its
previous version. The four-file set is not a single filesystem transaction; after a
hard termination during publication, regenerate to synchronize all four outputs.

## Manifest

Paths inside the manifest are relative to its batch directory. The file is written
before recording and atomically replaced after every case, including skips/failures.
An existing manifest must have a matching `batchId`, a `testCases` array, unique
valid case IDs/classes, nonempty titles and valid statuses. Each entry must use
`folder: "."`, `workFolder: ".work/<id>"` and the shared sprint filenames shown below.
Incompatible manifests are rejected before any writes, even with `-DryRun`, full
regeneration or `-Only`. Existing files do not authorize automatic path repair.
Earlier completed entries survive interruption. Interrupted/in-progress cases can
remain `planned`; graceful shutdown cleans up the watcher, but a forcibly killed
PowerShell process cannot guarantee cleanup.

```json
{
  "batchId": "Sprint12",
  "createdAtUtc": "2026-10-21T10:00:00.0000000Z",
  "targetUrl": "<effective TargetUrl>",
  "testCases": [
    {
      "id": "TC01",
      "title": "Create inspection order with valid data",
      "startUrl": "<effective case URL>",
      "preconditions": "User is logged in",
      "expectedResult": "Order is created and confirmation shown",
      "priority": "High",
      "dataHint": "InspectionsCreateOrder",
      "folder": ".",
      "workFolder": ".work/TC01",
      "codeTs": "Code.ts",
      "codeCs": "Code.cs",
      "report": "CSharpGenerationReport.json",
      "tableMetadata": "TableLocatorMetadata.json",
      "status": "planned",
      "reviewRequired": false,
      "issues": [],
      "actionCount": 0,
      "unsupportedActionCount": 0,
      "transformedTableActions": 0,
      "recordedAtUtc": null
    }
  ]
}
```

Statuses are `planned`, `recorded`, `generated`, `skipped`, or `failed: <reason>`.
An empty recording is `failed: empty recording`. Action counts come from the C#
report (`unsupportedActionCount`, or the length of its existing `unsupportedActions`
array); transformed table counts come from metadata `transformedActions`.
`recordedAtUtc` records successful browser recording time, not regeneration time;
`-Only -GenerateOnly` retains an existing timestamp. Imported samples have no known
recording timestamp. At the end a summary is printed and any failed manifest entry
causes exit code 1 (including retained failures outside `-Only`).

## Combined report and metadata

The shared report contains `batchId`, `generatedAtUtc`, `codeGenerationBlocked`, `reviewRequired` and
`cases[]`. Each case has `testCaseId`, `title`, `status`, `included`, `className`,
`actionCount`, `unsupportedActions`, `locatorValidation`, `locatorRepair`,
`codeGenerationBlocked`, `reviewRequired`, `issues` and `validation`. Skipped/planned cases have no fresh
validation evidence (`null`); failed cases retain their diagnostics but no code block.
The top-level blocked flag is true if any case is blocked, even when other cases
were generated. A process error can still fail the batch without a blocked report.

Shared table metadata keeps an `actions[]` array and summed `analyzedActions` and
`transformedActions`. Every action includes:
- `testCaseId`: owning case.
- `sourceLine`: original 1-based line in the internal case file.
- `relativeLine`: original 1-based line relative to the start of that case's `test()`
  statement (the test declaration is line 1).
- `line`: recomputed absolute 1-based line in the merged sprint Code.ts.

All other original entry fields are preserved. Line offsets are recalculated on
every rebuild, including when cases are replaced, excluded or their titles change.
Never run the single-flow table engine or C# generator directly on the shared file;
use `StartCodegen.ps1 -GenerateOnly` to process `.work` and merge the results.

Recording with `-SkipCSharpGeneration` keeps the internal TypeScript but invalidates
the selected case's old report; it is excluded from the paired shared outputs until
a successful `-GenerateOnly` run creates fresh C# and validation evidence.

## Safety and limitations

The `v1.3-before-phase1` tag marks the pre-change commit only, not uncommitted work.
Ignoring the saved session does not untrack a session already committed to git.
Avoid committing credentials; removing tracked session history is a separate task.
No prompts, framework C# files or business method names are changed by Phase 1.
Dry-run and offline sample regeneration do not verify a real headed recording,
authentication reuse, DOM replay, or application-specific expected results.

Keep sprints to about 15 cases for manageable agent context. Split larger sprints
into names such as `Sprint12-A` and `Sprint12-B`. Phase 2 should read the shared
Code.cs and manifest.json, not internal `.work` files.

## AI generation step

1. Attach `AIRecorder/SprintPrompt.md` in agent chat (plain Markdown, not an
  auto-discovered slash command). Fill in `Batch` and `Feature` (feature stem).
2. Pass 1 reads all shared sprint inputs and actual framework references, produces
  one plan table for every case, then stops. No code, workbook, CSV or recording
  writes. Review title/flow mismatches, URLs, reuse, Excel needs and assertion TODOs.
3. Explicitly approve Pass 2 before implementation. `FrameworkPrompt.md` owns code
  rules; `SprintPrompt.md` owns workflow. Draft classes are never promoted wholesale.
4. Pass 3 builds only; it does not execute tests. Review the diff and manually import
  `DataFiles/Templates/<Batch>_<Feature>.csv` into the stated workbook/sheet, skipping
  its first `# Sheet:` comment line. Existing workbooks are never edited by the agent.

Use `AutomationFrameWork.Helpers.TestCaseContext.GetTestCaseId(scenarioContext)`
and `ExcelUtility.ReadByTestCaseId(sheetName, id)`. The Excel reader returns a
case-insensitive string dictionary (trimmed cells, blank values retained) using
the first used row as headers, like `ReadAsList`. It rejects missing/duplicate
case rows, missing TestCaseId, duplicate headers and missing/empty sheets.
Tags are read in order: the first matching `^TC[A-Za-z0-9_-]+$` wins; `TC` is
uppercase and Reqnroll removes the Gherkin `@` prefix. Missing IDs fail clearly.
Shared `CommonActionsPage.FillAsync` and `SelectDropdownAsync` wait for visibility;
the latter selects a native HTML option by **value**, not label or custom widget.

### Running one case (manual execution after review)

With this repository's Reqnroll.xUnit 3.3.3 / xUnit v2 / VSTest adapter, `@TC01`
generates `[Xunit.Trait("Category", "TC01")]`. Verified using a throwaway external
tagged feature: discovery with `--list-tests --filter "Category=TC01"` listed only
the TC01 scenario, without executing it. Existing root features have no TC tags yet.

From the repository root, after approved generation and data preparation:

```powershell
dotnet test .\AutomationFrameWork.csproj --filter "Category=TC01"
```

If IDs repeat across features, narrow by the actual Gherkin Feature title:

```powershell
dotnet test .\AutomationFrameWork.csproj --filter "Category=TC01&FeatureTitle=Inspections Create Order"
```

The FeatureTitle value is the `Feature:` text, not the file stem. These are manual
execution instructions; the sprint prompt must not run them. A build or successful
generation is not business-flow validation. Resolve TODO assertions (which throw),
unverified locators, missing login bindings and error-page URLs first.

### Tiered generation policy and recording guards

Default policy B separates review findings from structural failures:

- **Tier 1:** crashes, unparseable TypeScript, invalid C#, undeclared awaited
  variables, failed compiler/structural validation, failed data/method gates or
  merge errors exclude the case and exit 1. Real project generation compiles the
  draft in an external temporary project referencing the framework; compilation
  failure (including unavailable tooling/dependencies) blocks. Standalone API
  fixtures with no project report compilation UNAVAILABLE, never PASSED. The merger
  rechecks structure and the validated draft hash to reject stale/edited C#.
- **Tier 2:** locator FAIL rules, incomplete replay, compilable unsupported actions
  and recording guards keep the case in shared TS/C#, with `reviewRequired: true`
  and `issues[]`. Locator rule outcomes and fidelity findings are not weakened.
  Validation success means structural validity, NOT successful application replay.
  Unsupported draft actions explicitly throw until implemented/re-recorded.
- The final table has a REVIEW column, followed by `N case(s) need review` and
  each flagged case's issues. Tier-2-only batches exit 0. Each review class has a
  `// REVIEW REQUIRED: ...` header. No markers are inserted into TypeScript.
- `-StrictLocators` (generator CLI: `--strict-locators true`) restores previous
  locator-failure exclusion/exit 1 and unsupported-action blocking. Incomplete
  replay alone and new recording guards remain review-only, as strict locator
  enforcement does not turn missing evidence into a failed rule.

Guards inspect original per-case TypeScript during generation, including GenerateOnly:

- `recordingStart`: first page.goto path contains ErrorPages, ServerError or an
  entire error path segment, case-insensitively. Warn to check app/session and re-record.
- `suspiciousNavigation`: a later page.goto follows click/fill/press/check with no
  intervening action, on the same origin as the preceding recorded navigation.
  It may reload state lost before the next action; flag only, never rewrite/remove.
  This is recorded-origin evidence, not proof of the live landing origin after redirects.
- Diagnostics and manifest URL strings contain host/path only, with query and
  fragment removed. Actual navigation inputs and recorded TS are NOT sanitized or
  rewritten; keep those private. Manifest URLs are diagnostic, not replay inputs.

Pass 1 must enumerate every issue for flagged cases and propose re-recording, an
evidence-backed stable locator, or a TODO assertion. It must explicitly disclose
any planned reuse of a flagged locator and cannot call downstream replay verified.

### Case diagnostics

The generator and merger print `GenerationIssue` lines with case ID, source line,
locator expression, rule ID and message, followed by a suggested action. `LV012`
includes expected versus observed match counts when available. A zero count proves
absence in the observed state, not necessarily an incorrect selector: check the
preceding navigation and required UI state before fixing/re-recording the selector.
Other rule failures need selector review or a validator bug report with DOM evidence.

Each manifest test case now has `issues[]` entries with `severity` (`error` or
`warning`), `kind` (`locatorValidation`, `replayIncomplete`, `unsupportedAction`,
`recordingStart`, `suspiciousNavigation`, or `generation`), `sourceLine`, `locator`, `ruleId`, and `message`. Unavailable
line/locator/rule fields are `null`. Planned/skipped cases have an empty array;
failed cases without a readable report retain a generation-status issue. Issues
are recomputed from current reports, not accumulated across regenerations. Source
lines refer to the per-case `.work/<id>/Code.ts`, not the merged sprint file.

`locatorValidation.observationCoverage` adds `stoppedAtLine`, `reason`,
`totalActionCount`, `replayedActionCount` (explicit successes),
`attemptedActionCount` (explicit successes plus failures), and `skippedActionCount`.
Older observations without execution statuses cannot establish these counts;
zero explicit successes does not prove that nothing ran. `firstUntrustedLine`
retains its original meaning: the stopping locator can have valid zero-match
evidence while only later locators are unverified. The original timeout/error is
preserved; diagnostics do not guess whether a popup, dialog or navigation caused it.

Structurally failed cases remain excluded; review cases are retained. All case
reports and manifest issues remain available for Pass 1. An existing per-case C#
file can be stale and is not permission to include the case. No business tests or
application replay are authorized by generation or these diagnostics.

For read-only investigation, copy the sprint and recorder tooling into an external
temporary project layout, using the same dependencies. Run the copied entry script
with `-GenerateOnly -SkipLiveObservation -SkipTableLocatorPostProcess -NoPrompt`
and the copied CSV. The script derives Recordings from its own location: changing
the working directory alone does **not** redirect output. Preserve the original
observations/metadata in the copy; do not use a real session or recapture live data.
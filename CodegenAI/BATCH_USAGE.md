# Phase 1b: one output pair per sprint

Run these commands from the `CodegenAI` directory in Windows PowerShell 5.1.
Each case is still recorded and processed separately, but the files to review are
the sprint's **Code.ts**, **Code.cs** and **manifest.json**. The existing
single-recording command, paths and failure handling are unchanged.

## Test case CSV

Create/edit [testcases.csv](testcases.csv), with all seven column headers:

```csv
TestCaseId,Title,StartUrl,Preconditions,ExpectedResult,Priority,DataHint
TC01,Create inspection order with valid data,,User is logged in,Order is created and confirmation shown,High,InspectionsCreateOrder
TC02,Create inspection order with missing mandatory field,,User is logged in,Validation message is shown,Medium,
```

`TestCaseId` must be unique (case-insensitive on Windows), match
`^[A-Za-z0-9_-]+$`, and not be a reserved Windows device name. `Title` cannot
be blank. Quote CSV values containing commas or newlines. Blank `StartUrl` uses
`-TargetUrl`, including its existing default. No additional application URL is
hardcoded by batch mode; C# URL resolution continues to use the repository's
appsettings configuration.

Each generated class is `CodegenFlow<TestCaseId>`; hyphens become underscores.
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
.\StartCodegen.ps1 -BatchFile .\testcases.csv -BatchName Sprint12 -GenerateOnly -SkipLiveObservation
.\StartCodegen.ps1 -BatchFile .\testcases.csv -BatchName Demo -DryRun
.\StartCodegen.ps1                       # legacy single recording, unchanged
```

Add a `TC03` row to the CSV before using the second command. Multiple IDs can
be selected with `-Only TC01,TC02`. Paths supplied with `-BatchFile` are relative
to the current directory (or absolute).

- Normal recording prints the case title, preconditions, expected result and URL.
  Press Enter to record, `s` to skip, or `q` to stop; unvisited cases stay planned.
  `-NoPrompt` suppresses this pause, not the interactive browser recording itself.
- Saved session initialization happens once before recording; its validity is
  rechecked before every case. Each recording saves the session for the next case.
- `-DryRun` validates, prints the plan and writes only a planned manifest inside
  the sprint directory. It does not create `.work`, Code.ts, Code.cs or combined
  reports, update the latest-batch pointer, initialize the session or open a browser.
  Existing output files are not deleted by a dry run; use a fresh name for planning.
- `-GenerateOnly` runs table rewriting and final C# generation for existing
  recordings, without prompts, session initialization, browser or watcher.
  Live observation is forcibly disabled, even without `-SkipLiveObservation`.
  Input is `.work/<TestCaseId>/Code.ts`, not the merged sprint file. Previously saved
  per-case observations can still be consumed. Missing recordings
  are skipped; recordings without an `await page.` action fail. It cannot be
  combined with `-SkipCSharpGeneration`.
- To regenerate C# without rewriting recorded TypeScript, also use
  `-SkipTableLocatorPostProcess`. Existing DOM/table evidence remains available.
- C# generation now checks actual emitted action order (`actionFidelity` in each
  case report), including popup/download boundaries. Omitted, duplicated,
  reordered or unsupported parsed statements block publication instead of
  producing a successful report with unsupported-action comments. This applies
  to legacy single recordings too; the previous good internal C# is not overwritten.
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
  zero/duplicate matches still block generation. Offline regeneration does not
  repair the saved evidence or prove the business flow works; a fresh complete
  observation is needed for that. Observation replays actions against the target
  application, so use suitable test data to avoid duplicate business operations.
- `-Only` merges selected entries into an existing manifest and does not touch
  unselected working files. Shared outputs are rebuilt in CSV order with the case
  replaced in place. Reuse `-BatchName` to resume a batch. Without `-Only`,
  a fresh plan is written for every row in the CSV. Dry-run replans selected entries;
  use a separate batch name if you want to preserve their prior statuses.
- Re-recording a selected case replaces its old TypeScript and DOM/table metadata.
  Failed generation may leave an earlier internal C# file; the manifest status is
  authoritative, and failed/skipped/planned cases are excluded from the merged code.
  Raw recordings are retained on generation failure. A failure on one case does not
  remove successful cases from the sprint outputs.
- After every processed case (including failure/skip), and at the end, the merger
  rebuilds all four shared artifacts. Only successful cases with both outputs and a
  valid report are included in Code.ts/Code.cs. The report still includes every
  manifest case and its status/diagnostics. Empty merged files mean no eligible cases.
- Malformed TypeScript, multiple tests in one working file, mismatched class identity,
  or invalid metadata line references produce `failed: sprint merge error`. Other
  valid cases are still published. Do not append several tests to one internal file.

## Output layout

```text
CodegenAI/
  Recordings/
    latest-batch.txt                 # Recordings/Sprint12 (relative to CodegenAI)
    Sprint12/
      manifest.json
      Code.ts                       # one header; TC01, TC02, ... test blocks
      Code.cs                       # shared usings/namespace; one class per case
      CSharpGenerationReport.json   # per-case sections, including failed cases
      TableLocatorMetadata.json     # tagged entries and merged-file line numbers
      .work/                        # INTERNAL: not Phase 2 inputs
        TC01/
          Code.ts
          Code.cs
          CSharpGenerationReport.json
          TableLocatorMetadata.json
          LiveObservations.json     # only when observation is enabled
        TC02/
          ...same internal artifacts...
```

Each recording watcher uses `.csharp-live-sync.stop` inside its case folder and
removes it during cleanup. Disabled pipeline stages do not create their artifacts.
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

The shared report contains `batchId`, `generatedAtUtc`, `codeGenerationBlocked` and
`cases[]`. Each case has `testCaseId`, `title`, `status`, `included`, `className`,
`actionCount`, `unsupportedActions`, `locatorValidation`, `locatorRepair`,
`codeGenerationBlocked` and `validation`. Skipped/planned cases have no fresh
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
# Phase 1: batch recording

Run these commands from the `CodegenAI` directory in Windows PowerShell 5.1.
The existing single-recording command and its defaults are unchanged.

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
- `-DryRun` validates, prints the plan, creates case folders and a planned manifest.
  It does not initialize the session, launch a browser, start a watcher or generate.
- `-GenerateOnly` runs table rewriting and final C# generation for existing
  recordings, without prompts, session initialization, browser or watcher.
  Live observation is forcibly disabled, even without `-SkipLiveObservation`.
  Previously saved per-case observations can still be consumed. Missing recordings
  are skipped; recordings without an `await page.` action fail. It cannot be
  combined with `-SkipCSharpGeneration`.
- `-Only` merges selected entries into an existing manifest and does not touch
  unselected folders/entries. Reuse `-BatchName` to resume a batch. Without `-Only`,
  a fresh plan is written for every row in the CSV. Dry-run replans selected entries;
  use a separate batch name if you want to preserve their prior statuses.
- Re-recording a selected case replaces its old TypeScript and DOM/table metadata.
  Failed generation may leave a previous C# file/report; the manifest status is
  authoritative. Raw recordings are retained on generation failure.

## Output layout

```text
CodegenAI/
  Recordings/
    latest-batch.txt                 # Recordings/Sprint12 (relative to CodegenAI)
    Sprint12/
      manifest.json
      TC01/
        Code.ts
        Code.cs                     # CodegenFlowTC01
        CSharpGenerationReport.json
        TableLocatorMetadata.json
        LiveObservations.json       # when live observation is enabled
      TC02/
        Code.ts
        Code.cs                     # CodegenFlowTC02
        CSharpGenerationReport.json
        TableLocatorMetadata.json
        LiveObservations.json
```

Each recording watcher uses `.csharp-live-sync.stop` inside its case folder and
removes it during cleanup. Disabled pipeline stages do not create their artifacts.
The recording directory is excluded from .NET compilation/resources/items and git.
Case class names avoid collisions within a batch, not between copies of the same
case in different batches. Review output before promoting it into compiled code.

## Manifest

Paths inside the manifest are relative to its batch directory. The file is written
before recording and atomically replaced after every case, including skips/failures.
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
      "folder": "TC01",
      "codeTs": "TC01/Code.ts",
      "codeCs": "TC01/Code.cs",
      "report": "TC01/CSharpGenerationReport.json",
      "tableMetadata": "TC01/TableLocatorMetadata.json",
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

## Safety and limitations

The `v1.3-before-phase1` tag marks the pre-change commit only, not uncommitted work.
Ignoring the saved session does not untrack a session already committed to git.
Avoid committing credentials; removing tracked session history is a separate task.
No prompts, framework C# files or business method names are changed by Phase 1.
Dry-run and offline sample regeneration do not verify a real headed recording,
authentication reuse, DOM replay, or application-specific expected results.
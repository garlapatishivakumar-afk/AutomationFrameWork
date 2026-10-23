param(
	[string]$TargetUrl,
	[string]$TestIdAttribute = 'data-testid',
	[string]$TableSelector = 'table',
	[switch]$SkipLiveObservation,
	[switch]$TableLocatorDebug, 
	[switch]$SkipTableLocatorPostProcess,
	[switch]$SkipCSharpGeneration,
	[string]$BatchFile,
	[string]$BatchName = (Get-Date -Format 'yyyyMMdd-HHmmss'),
	[string[]]$Only,
	[switch]$GenerateOnly,
	[switch]$StrictLocators,
	[switch]$DryRun,
	[switch]$NoPrompt
)

Write-Host "Starting Playwright Codegen..."

$sessionScript = Join-Path $PSScriptRoot "AIRecorder\auth\SessionManager.ps1"
$postProcessScript = Join-Path $PSScriptRoot "AIRecorder\auth\PostProcessCodegen.ps1"
$liveObserverScript = Join-Path $PSScriptRoot "AIRecorder\Intelligence\LiveObserver.cjs"
$liveTableEngineScript = Join-Path $PSScriptRoot "AIRecorder\Intelligence\LiveTableLocatorEngine.cjs"
$csharpGeneratorScript = Join-Path $PSScriptRoot "AIRecorder\Generator\CSharpCodeGenerator.cjs"
$csharpLiveSyncScript = Join-Path $PSScriptRoot "AIRecorder\Generator\CSharpLiveSync.cjs"
$sessionPath = Join-Path $PSScriptRoot "AIRecorder\auth\session.json"
$outputFile = Join-Path $PSScriptRoot 'Code.ts'
$domObservationFile = Join-Path $PSScriptRoot "AIRecorder\LiveObservations.json"
$tableLocatorMetadataFile = Join-Path $PSScriptRoot "AIRecorder\TableLocatorMetadata.json"
$csharpOutputFile = Join-Path $PSScriptRoot "Code.cs"
$csharpReportFile = Join-Path $PSScriptRoot "CSharpGenerationReport.json"
$csharpStopSignalFile = Join-Path $PSScriptRoot ".csharp-live-sync.stop"
$appSettingsFile = Join-Path (Split-Path $PSScriptRoot -Parent) "appsettings.json"
$maxAgeDays = 4
$liveCSharpJob = $null

# App settings allow JSON comments; preserve quoted strings (including https://)
# while stripping comments for Windows PowerShell 5.1's ConvertFrom-Json.
if ([string]::IsNullOrWhiteSpace($TargetUrl)) {
	try {
		$settingsText = Get-Content -LiteralPath $appSettingsFile -Raw -ErrorAction Stop
		$settingsText = [regex]::Replace($settingsText, '"(?:\\.|[^"\\])*"|//[^\r\n]*|/\*[\s\S]*?\*/', {
			param($Match)
			if ($Match.Value.StartsWith('"')) { return $Match.Value }
			return ' '
		})
		$settings = $settingsText | ConvertFrom-Json -ErrorAction Stop
		$TargetUrl = [string]$settings.Urls.IReport
	} catch {
		throw 'Cannot read appsettings.json. Configure Urls.IReport with the application URL.'
	}
	if ([string]::IsNullOrWhiteSpace($TargetUrl)) {
		throw 'Configure Urls.IReport in appsettings.json with the application URL.'
	}
}

function Protect-DiagnosticText([string]$Value) {
	return [regex]::Replace($Value, 'https?://[^\s"''<>`]+', {
		param($Match)
		try { $uri = [Uri]$Match.Value; return $uri.GetLeftPart([System.UriPartial]::Path) }
		catch { return ($Match.Value -split '[?#]')[0] }
	})
}

function Protect-ManifestValue($Value) {
	if ($Value -is [string]) { return (Protect-DiagnosticText $Value) }
	if ($Value -is [array]) { return ,@($Value | ForEach-Object { Protect-ManifestValue $_ }) }
	if ($Value -is [pscustomobject]) {
		$copy = [ordered]@{}
		foreach ($property in $Value.PSObject.Properties) { $copy[$property.Name] = Protect-ManifestValue $property.Value }
		return [pscustomobject]$copy
	}
	return $Value
}

function Invoke-CodegenNode([string[]]$Arguments) {
	# PS 5.1 represents native stderr as ErrorRecords when streams are merged.
	# Preserve the native exit code, but sanitize both streams before displaying.
	$ErrorActionPreference = 'Continue'
	& node @Arguments 2>&1 | ForEach-Object { Write-Host (Protect-DiagnosticText ([string]$_)) }
	$nativeExitCode = $LASTEXITCODE
	Set-Variable -Name LASTEXITCODE -Scope 1 -Value $nativeExitCode
}

function Invoke-LegacyTableLocatorPipeline {
	param(
		[switch]$SkipObservation,
		[switch]$SkipPostProcess,
		[switch]$Debug
	)

	if (-not $SkipObservation) {
		if (Test-Path $liveObserverScript) {
			$observerArgs = @(
				$liveObserverScript,
				'--code-file', $outputFile,
				'--output-file', $domObservationFile,
				'--storage-state-file', $sessionPath
			)

			if ($Debug) {
				$observerArgs += @('--debug', 'true')
			}

			Invoke-CodegenNode -Arguments $observerArgs
			if ($LASTEXITCODE -ne 0) {
				Write-Warning "Live observation failed. Continuing with fallback behavior."
			}
		} else {
			Write-Warning "Live observer not found: $liveObserverScript"
		}
	}

	if (-not $SkipPostProcess) {
		if (Test-Path $postProcessScript) {
			. $postProcessScript
			Invoke-CodegenTableLocatorPostProcess `
				-CodeFilePath $outputFile `
				-DomFilePath $domObservationFile `
				-MetadataFilePath $tableLocatorMetadataFile `
				-TableSelector $TableSelector `
				-Debug:$Debug
		} else {
			Write-Warning "Post processor not found: $postProcessScript"
		}
	}
}

function Invoke-CodegenRecording {
	param(
		[string]$CodeFile,
		[string]$CsFile,
		[string]$ReportFile,
		[string]$DomFile,
		[string]$MetadataFile,
		[string]$StopFile,
		[string]$TargetUrl,
		[string]$ClassName,
		[string]$CaseId,
		[string]$CaseTitle
	)

	# Local aliases also scope the legacy fallback to this recording's files.
	$outputFile = $CodeFile
	$csharpOutputFile = $CsFile
	$csharpReportFile = $ReportFile
	$domObservationFile = $DomFile
	$tableLocatorMetadataFile = $MetadataFile
	$csharpStopSignalFile = $StopFile
	$liveCSharpJob = $null
	$identityArgs = @()
	if ($CaseId) {
		$identityArgs = @('--class-name', $ClassName, "--case-id=$CaseId", "--case-title=$CaseTitle", '--project-root', (Split-Path $PSScriptRoot -Parent))
	}
	if ($StrictLocators) { $identityArgs += @('--strict-locators', 'true') }

try {
if (-not $GenerateOnly) {
$loadExistingSession = Test-CodegenSessionValid -Path $sessionPath -MaxAgeDays $maxAgeDays

$codegenArgs = Get-CodegenArgs `
	-TargetUrl $TargetUrl `
	-OutputFile $outputFile `
	-SessionPath $sessionPath `
	-TestIdAttribute $TestIdAttribute `
	-LoadSession:$loadExistingSession

	# A re-recording must not accidentally reuse an old nonempty recording or DOM.
	if ($CaseId) {
		foreach ($artifact in @($outputFile, $domObservationFile, $tableLocatorMetadataFile)) {
			if (Test-Path -LiteralPath $artifact) { Remove-Item -LiteralPath $artifact -Force }
		}
	}

if (-not $SkipCSharpGeneration) {
	if (Test-Path $csharpLiveSyncScript) {
		if (Test-Path $csharpStopSignalFile) {
			Remove-Item $csharpStopSignalFile -Force
		}

		$liveCSharpJob = Start-Job -ScriptBlock {
			param(
				[string]$ScriptPath,
				[string]$CodeFile,
				[string]$OutputFile,
				[string]$ReportFile,
				[string]$AppSettings,
				[string]$StopFile,
				[string]$DomFile,
				[string]$MetadataFile,
				[string[]]$IdentityArgs
			)

			& node $ScriptPath '--code-file' $CodeFile '--output-file' $OutputFile '--report-file' $ReportFile '--appsettings-file' $AppSettings '--dom-file' $DomFile '--metadata-file' $MetadataFile '--stop-signal-file' $StopFile '--enterprise-mode' 'true' @IdentityArgs
		} -ArgumentList $csharpLiveSyncScript, $outputFile, $csharpOutputFile, $csharpReportFile, $appSettingsFile, $csharpStopSignalFile, $domObservationFile, $tableLocatorMetadataFile, $identityArgs

		Write-Host "[LiveCSharp] Started watcher for Code.ts -> Code.cs"
	} else {
		Write-Warning "Live C# watcher not found: $csharpLiveSyncScript"
	}
}

	npx @codegenArgs
	if ($CaseId -and $LASTEXITCODE -ne 0) { throw "Playwright codegen exited with code $LASTEXITCODE" }
}

if ($CaseId) {
	if (-not (Test-Path -LiteralPath $outputFile) -or -not (Select-String -LiteralPath $outputFile -Pattern 'await\s+page\.' -Quiet)) {
		throw 'empty recording'
	}
}

if ((-not $SkipLiveObservation) -or (-not $SkipTableLocatorPostProcess)) {
	if (Test-Path $liveTableEngineScript) {
		$engineArgs = @(
			$liveTableEngineScript,
			'--code-file', $outputFile,
			'--dom-file', $domObservationFile,
			'--metadata-file', $tableLocatorMetadataFile,
			'--storage-state-file', $sessionPath,
			'--table-selector', $TableSelector,
			'--skip-observation', $SkipLiveObservation.IsPresent.ToString().ToLower(),
			'--skip-rewrite', $SkipTableLocatorPostProcess.IsPresent.ToString().ToLower()
		)

		if ($TableLocatorDebug) {
			$engineArgs += @('--debug', 'true')
		}

		$engineFailed = $false
		try {
			Invoke-CodegenNode -Arguments $engineArgs
			if ($LASTEXITCODE -ne 0) {
				$engineFailed = $true
			}
		}
		catch {
			$engineFailed = $true
			Write-Warning "Live Table Locator Engine threw an exception: $($_.Exception.Message)"
		}

		if ($engineFailed) {
			Write-Warning "Live Table Locator Engine failed. Running legacy fallback pipeline."
			Invoke-LegacyTableLocatorPipeline `
				-SkipObservation:$SkipLiveObservation `
				-SkipPostProcess:$SkipTableLocatorPostProcess `
				-Debug:$TableLocatorDebug
		}
	} else {
		Invoke-LegacyTableLocatorPipeline `
			-SkipObservation:$SkipLiveObservation `
			-SkipPostProcess:$SkipTableLocatorPostProcess `
			-Debug:$TableLocatorDebug
	}
}

if (-not $SkipCSharpGeneration -and (Test-Path $csharpGeneratorScript)) {
	$csharpArgs = @(
		$csharpGeneratorScript,
		'--code-file', $outputFile,
		'--output-file', $csharpOutputFile,
		'--report-file', $csharpReportFile,
		'--appsettings-file', $appSettingsFile,
		'--dom-file', $domObservationFile,
		'--metadata-file', $tableLocatorMetadataFile,
		'--enterprise-mode', 'true'
	)
	$csharpArgs += $identityArgs

	# Never mistake an earlier report for the result of this final generation.
	if (Test-Path -LiteralPath $csharpReportFile) { Remove-Item -LiteralPath $csharpReportFile -Force -ErrorAction Stop }
	$generationExitCode = 1
	try {
		Invoke-CodegenNode -Arguments $csharpArgs
		$generationExitCode = $LASTEXITCODE
	} catch {
		Write-Warning "C# generator invocation failed: $($_.Exception.Message)"
	}
	$generationReport = $null
	try {
		$generationReport = Get-Content -LiteralPath $csharpReportFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
	} catch {
		Write-Warning 'Final C# generation did not produce a readable report.'
	}
	if ($generationReport -and (
		$generationReport.codeGenerationBlocked -eq $true -or
		($StrictLocators -and $generationReport.locatorRepair.codeGenerationBlocked -eq $true) -or
		($StrictLocators -and $generationReport.locatorValidation.hasFailures -eq $true) -or
		$generationReport.compilation.success -eq $false -or
		$generationReport.dataContract.blocking -eq $true -or
		$generationReport.methodQualityGate.blocking -eq $true -or
		$generationReport.validation.success -eq $false
	)) {
		throw 'generation blocked'
	}
	if ($generationExitCode -ne 0 -or -not $generationReport -or $generationReport.validation.success -ne $true -or -not (Test-Path -LiteralPath $csharpOutputFile)) {
		throw 'generation error'
	}
} elseif (-not $SkipCSharpGeneration) {
	Write-Warning "C# generator not found: $csharpGeneratorScript"
	throw 'generation error'
}
}
finally {
	if ($liveCSharpJob) {
		Set-Content -Path $csharpStopSignalFile -Value "stop"
		Wait-Job -Job $liveCSharpJob -Timeout 10 | Out-Null
		Receive-Job -Job $liveCSharpJob -Keep | Out-Null
		if ($liveCSharpJob.State -eq 'Running') {
			Stop-Job -Job $liveCSharpJob | Out-Null
		}
		Remove-Job -Job $liveCSharpJob -Force | Out-Null
		if (Test-Path $csharpStopSignalFile) {
			Remove-Item $csharpStopSignalFile -Force
		}
		Write-Host "[LiveCSharp] Watcher stopped"
	}
	if ($CaseId -and (Test-Path -LiteralPath $csharpStopSignalFile)) {
		Remove-Item -LiteralPath $csharpStopSignalFile -Force
	}
}

Write-Host "Codegen closed."
}

if (-not $BatchFile) {
	if ($GenerateOnly -or $DryRun -or $Only -or $NoPrompt -or $PSBoundParameters.ContainsKey('BatchName')) {
		throw 'Batch options require -BatchFile.'
	}
	if (-not (Test-Path $sessionScript)) { throw "Session helper not found: $sessionScript" }
	. $sessionScript
	Initialize-CodegenSession -SessionPath $sessionPath -MaxAgeDays $maxAgeDays
	try {
		Invoke-CodegenRecording -CodeFile $outputFile -CsFile $csharpOutputFile -ReportFile $csharpReportFile `
			-DomFile $domObservationFile -MetadataFile $tableLocatorMetadataFile -StopFile $csharpStopSignalFile -TargetUrl $TargetUrl
	} catch {
		Write-Error "Codegen failed: $($_.Exception.Message). Review $csharpReportFile; an existing Code.cs may be stale." -ErrorAction Continue
		exit 1
	}
	return
}

# All validation precedes session initialization, browser launch and folder creation.
$ErrorActionPreference = 'Stop'
$sprintMergerScript = Join-Path $PSScriptRoot 'AIRecorder\Generator\SprintMerger.cjs'
$sprintMergeFailed = $false
if (-not $DryRun -and -not (Test-Path -LiteralPath $sprintMergerScript)) { throw "Sprint merger not found: $sprintMergerScript" }
if ($GenerateOnly -and $SkipCSharpGeneration) { throw '-GenerateOnly cannot be combined with -SkipCSharpGeneration.' }
if ($BatchName -notmatch '^[A-Za-z0-9_-]+$') { throw 'BatchName must contain only letters, digits, underscores or hyphens.' }
function Test-ReservedFolderName([string]$Name) {
	return $Name -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$'
}
if (Test-ReservedFolderName $BatchName) { throw "Reserved Windows folder name: $BatchName" }
$rows = @(Import-Csv -LiteralPath $BatchFile)
if ($rows.Count -eq 0) { throw 'Batch CSV must contain at least one test case.' }
$columns = @('TestCaseId', 'Title')
foreach ($column in $columns) {
	if ($rows[0].PSObject.Properties.Name -notcontains $column) { throw "Missing CSV column: $column" }
}
$ids = @{}
$classNames = @{}
foreach ($row in $rows) {
	$id = [string]$row.TestCaseId
	if ($id -notmatch '^[A-Za-z0-9_-]+$') { throw "Invalid TestCaseId: '$id'" }
	if (Test-ReservedFolderName $id) { throw "Reserved Windows folder name: $id" }
	if ($ids.ContainsKey($id)) { throw "Duplicate TestCaseId: $id" }
	if ([string]::IsNullOrWhiteSpace($row.Title)) { throw "Title is required for $id" }
	if ($row.Title -match '[\r\n]') { throw "Title must be a single-line Scenario name for $id" }
	$className = 'CodegenFlow' + ($id -replace '[^A-Za-z0-9_]', '_')
	if ($classNames.ContainsKey($className)) { throw "TestCaseIds produce the same C# class: $id and $($classNames[$className])" }
	$ids[$id] = $true
	$classNames[$className] = $id
}
foreach ($id in $Only) {
	if (-not $ids.ContainsKey($id)) { throw "Unknown -Only TestCaseId: $id" }
}
$selectedRows = @($rows | Where-Object { -not $Only -or $Only -contains $_.TestCaseId })
$recordingsRoot = Join-Path $PSScriptRoot 'Recordings'
$batchFolder = Join-Path $recordingsRoot $BatchName
$manifestPath = Join-Path $batchFolder 'manifest.json'
$manifest = [pscustomobject][ordered]@{
	batchId = $BatchName
	createdAtUtc = [DateTime]::UtcNow.ToString('o')
	targetUrl = $TargetUrl
	testCases = @()
}
if (Test-Path -LiteralPath $manifestPath) {
	# Validate before any writes, including full replans and dry runs. Never repair
	# incompatible path fields implicitly or trust the presence of working files.
	try { $existingManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json }
	catch { throw 'Invalid batch manifest: cannot parse JSON. No outputs were changed.' }
	if ($existingManifest.batchId -cne $BatchName -or $existingManifest.testCases -isnot [array]) {
		throw 'Invalid batch manifest: expected matching batchId and a testCases array. No outputs were changed.'
	}
	$manifestIds = @{}
	$manifestClasses = @{}
	foreach ($existingEntry in $existingManifest.testCases) {
		if ($null -eq $existingEntry -or $existingEntry.id -isnot [string] -or
			$existingEntry.id -notmatch '^[A-Za-z0-9_-]+$' -or (Test-ReservedFolderName $existingEntry.id) -or
			$manifestIds.ContainsKey($existingEntry.id)) {
			throw 'Invalid batch manifest: invalid or duplicate case ID. No outputs were changed.'
		}
		$manifestIds[$existingEntry.id] = $true
		$manifestClass = 'CodegenFlow' + ($existingEntry.id -replace '-', '_')
		if ($manifestClasses.ContainsKey($manifestClass)) { throw 'Invalid batch manifest: duplicate case class. No outputs were changed.' }
		$manifestClasses[$manifestClass] = $true
		if ($existingEntry.title -isnot [string] -or [string]::IsNullOrWhiteSpace($existingEntry.title) -or
			$existingEntry.status -isnot [string] -or $existingEntry.status -cnotmatch '^(planned|recorded|generated|skipped|failed: .+)$') {
			throw 'Invalid batch manifest: missing or invalid case title/status. No outputs were changed.'
		}
		if ($existingEntry.workFolder -cne ".work/$($existingEntry.id)" -or $existingEntry.folder -cne '.' -or
			$existingEntry.codeTs -cne 'Code.ts' -or $existingEntry.codeCs -cne 'Code.cs' -or
			$existingEntry.report -cne 'CSharpGenerationReport.json' -or $existingEntry.tableMetadata -cne 'TableLocatorMetadata.json') {
			throw "Invalid batch manifest: $($existingEntry.id) requires workFolder '.work/$($existingEntry.id)' and shared sprint output paths. No outputs were changed."
		}
	}
	if ($Only) { $manifest = $existingManifest }
}

function Save-BatchManifest {
	# Replace atomically so an interrupted write cannot truncate the previous manifest.
	$tempPath = $manifestPath + '.tmp'
	$json = (Protect-ManifestValue $manifest) | ConvertTo-Json -Depth 30
	[System.IO.File]::WriteAllText($tempPath, $json, (New-Object System.Text.UTF8Encoding($false)))
	if (Test-Path -LiteralPath $manifestPath) {
		[System.IO.File]::Replace($tempPath, $manifestPath, [NullString]::Value)
	} else {
		[System.IO.File]::Move($tempPath, $manifestPath)
	}
}

function Publish-SprintArtifacts {
	Save-BatchManifest
	if ($DryRun) { return }
	Invoke-CodegenNode -Arguments @($sprintMergerScript, '--manifest-file', $manifestPath)
	$mergeExitCode = $LASTEXITCODE
	# The merger projects report diagnostics into issues[]. Keep the in-memory
	# manifest synchronized so later publishes do not erase those additive fields.
	if (Test-Path -LiteralPath $manifestPath) {
		$publishedManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
		foreach ($publishedEntry in $publishedManifest.testCases) {
			$currentEntry = @($manifest.testCases | Where-Object { $_.id -eq $publishedEntry.id })[0]
			if ($currentEntry -and $null -ne $publishedEntry.issues) {
				$currentEntry | Add-Member -NotePropertyName issues -NotePropertyValue @($publishedEntry.issues) -Force
				$currentEntry | Add-Member -NotePropertyName reviewRequired -NotePropertyValue ([bool]$publishedEntry.reviewRequired) -Force
			}
		}
	}
	if ($mergeExitCode -ne 0) {
		$script:sprintMergeFailed = $true
		Write-Error 'Sprint merge failed. Valid cases were retained where possible; inspect the sprint report.' -ErrorAction Continue
		$sharedReportPath = Join-Path $batchFolder 'CSharpGenerationReport.json'
		if (Test-Path -LiteralPath $sharedReportPath) {
			$sharedReport = Get-Content -LiteralPath $sharedReportPath -Raw | ConvertFrom-Json
			foreach ($caseReport in $sharedReport.cases) {
				if ($caseReport.mergeError) {
					$failedEntry = @($manifest.testCases | Where-Object { $_.id -eq $caseReport.testCaseId })[0]
					$failedEntry.status = 'failed: sprint merge error'
					$failedEntry | Add-Member -NotePropertyName mergeError -NotePropertyValue $caseReport.mergeError -Force
				}
			}
			Save-BatchManifest
		}
	}
}

New-Item -ItemType Directory -Path $batchFolder -Force | Out-Null
foreach ($row in $selectedRows) {
	$id = [string]$row.TestCaseId
	$caseUrl = $TargetUrl
	if (-not [string]::IsNullOrWhiteSpace($row.StartUrl)) { $caseUrl = $row.StartUrl.Trim() }
	$entry = [pscustomobject][ordered]@{
		id = $id; title = $row.Title; startUrl = $caseUrl
		preconditions = $row.Preconditions; expectedResult = $row.ExpectedResult
		priority = $row.Priority; dataHint = $row.DataHint
		folder = '.'; workFolder = ".work/$id"; codeTs = 'Code.ts'; codeCs = 'Code.cs'
		report = 'CSharpGenerationReport.json'; tableMetadata = 'TableLocatorMetadata.json'
		status = 'planned'; actionCount = 0; unsupportedActionCount = 0
		issues = @(); reviewRequired = $false
		transformedTableActions = 0; recordedAtUtc = $null
	}
	$existing = @($manifest.testCases | Where-Object { $_.id -eq $id })
	if ($GenerateOnly -and $existing.Count -gt 0) { $entry.recordedAtUtc = $existing[0].recordedAtUtc }
	$entries = @($manifest.testCases)
	$index = -1
	for ($i = 0; $i -lt $entries.Count; $i++) { if ($entries[$i].id -eq $id) { $index = $i; break } }
	if ($index -ge 0) { $entries[$index] = $entry } else { $entries += $entry }
	$manifest.testCases = $entries
	if (-not $DryRun) {
		New-Item -ItemType Directory -Path (Join-Path $batchFolder $entry.workFolder) -Force | Out-Null
	}
}
# The manifest is the merger's ordering authority. Preserve all unselected case
# metadata, but order current CSV rows first (including after an -Only update).
$orderedEntries = @()
foreach ($row in $rows) { $orderedEntries += @($manifest.testCases | Where-Object { $_.id -eq $row.TestCaseId }) }
$orderedEntries += @($manifest.testCases | Where-Object { -not $ids.ContainsKey($_.id) })
$manifest.testCases = $orderedEntries
Save-BatchManifest
if (-not $DryRun) {
	[System.IO.File]::WriteAllText((Join-Path $recordingsRoot 'latest-batch.txt'), "Recordings/$BatchName", (New-Object System.Text.UTF8Encoding($false)))
}

if (-not $DryRun -and -not $GenerateOnly) {
	if (-not (Test-Path $sessionScript)) { throw "Session helper not found: $sessionScript" }
	. $sessionScript
	Initialize-CodegenSession -SessionPath $sessionPath -MaxAgeDays $maxAgeDays
}
if ($GenerateOnly) {
	# Live observation replays the recording in a browser; regeneration must stay offline.
	$SkipLiveObservation = [switch]$true
}

$position = 0
foreach ($row in $selectedRows) {
	$position++
	$entry = @($manifest.testCases | Where-Object { $_.id -eq $row.TestCaseId })[0]
	Write-Host (Protect-DiagnosticText "[$position/$($selectedRows.Count)] $($entry.id) - $($entry.title)")
	Write-Host "  Tag: @$($entry.id)"
	if ($entry.preconditions) { Write-Host (Protect-DiagnosticText "  Preconditions: $($entry.preconditions)") }
	if ($entry.expectedResult) { Write-Host (Protect-DiagnosticText "  ExpectedResult: $($entry.expectedResult)") }
	Write-Host (Protect-DiagnosticText "  StartUrl: $($entry.startUrl)")
	if ($DryRun) { Save-BatchManifest; continue }
	if (-not $NoPrompt -and -not $GenerateOnly) {
		$answer = Read-Host 'Press Enter to record, s to skip, q to quit'
		if ($answer -eq 'q') { Publish-SprintArtifacts; break }
		if ($answer -eq 's') { $entry.status = 'skipped'; Publish-SprintArtifacts; continue }
	}
	$caseFolder = Join-Path $batchFolder $entry.workFolder
	$codeFile = Join-Path $caseFolder 'Code.ts'
	$reportFile = Join-Path $caseFolder 'CSharpGenerationReport.json'
	$metadataFile = Join-Path $caseFolder 'TableLocatorMetadata.json'
	if ($GenerateOnly -and -not (Test-Path -LiteralPath $codeFile)) {
		$entry.status = 'skipped'
		Write-Warning "No Code.ts for $($entry.id); skipping regeneration."
		Publish-SprintArtifacts
		continue
	}
	try {
		# Only fresh generation evidence may authorize inclusion in shared output.
		# This also excludes stale C# when recording with -SkipCSharpGeneration.
		if (Test-Path -LiteralPath $reportFile) { Remove-Item -LiteralPath $reportFile -Force }
		Invoke-CodegenRecording -CodeFile $codeFile -CsFile (Join-Path $caseFolder 'Code.cs') `
			-ReportFile $reportFile -DomFile (Join-Path $caseFolder 'LiveObservations.json') `
			-MetadataFile $metadataFile -StopFile (Join-Path $caseFolder '.csharp-live-sync.stop') `
			-TargetUrl $entry.startUrl -ClassName ('CodegenFlow' + ($entry.id -replace '[^A-Za-z0-9_]', '_')) `
			-CaseId $entry.id -CaseTitle $entry.title | Out-Host
		if ($GenerateOnly) { $entry.status = 'generated' } else { $entry.status = 'recorded'; $entry.recordedAtUtc = [DateTime]::UtcNow.ToString('o') }
		if (-not $SkipCSharpGeneration) {
			$report = Get-Content -LiteralPath $reportFile -Raw | ConvertFrom-Json
			$entry.actionCount = $report.actionCount
			if ($null -ne $report.unsupportedActionCount) { $entry.unsupportedActionCount = $report.unsupportedActionCount }
			else { $entry.unsupportedActionCount = @($report.unsupportedActions).Count }
		}
		if (Test-Path -LiteralPath $metadataFile) {
			$metadata = Get-Content -LiteralPath $metadataFile -Raw | ConvertFrom-Json
			if ($null -ne $metadata.transformedActions) { $entry.transformedTableActions = $metadata.transformedActions }
		}
	} catch {
		$entry.status = Protect-DiagnosticText "failed: $($_.Exception.Message)"
		# A blocked fresh report still contains useful action counts.
		if (Test-Path -LiteralPath $reportFile) {
			try {
				$failedReport = Get-Content -LiteralPath $reportFile -Raw | ConvertFrom-Json
				if ($null -ne $failedReport.actionCount) { $entry.actionCount = $failedReport.actionCount }
				$entry.unsupportedActionCount = @($failedReport.unsupportedActions).Count
			} catch { } # Preserve the original failure if the diagnostic report is invalid.
		}
		Write-Error "$($entry.id): $($entry.status). Review $reportFile; an existing Code.cs may be stale." -ErrorAction Continue
	} finally {
		Publish-SprintArtifacts
	}
}
if (-not $DryRun) { Publish-SprintArtifacts }
(Protect-ManifestValue $manifest).testCases | Select-Object id, @{Name='REVIEW';Expression={[bool]$_.reviewRequired}}, status, @{Name='actions';Expression={$_.actionCount}}, @{Name='unsupported';Expression={$_.unsupportedActionCount}}, title | Format-Table -AutoSize | Out-String -Width 240 | Write-Host
if (-not $DryRun) { Invoke-CodegenNode -Arguments @($sprintMergerScript, '--review-summary', $manifestPath) }
Write-Host "Sprint TypeScript: $(Join-Path $batchFolder 'Code.ts')"
Write-Host "Sprint C#: $(Join-Path $batchFolder 'Code.cs')"
if ($sprintMergeFailed -or @($manifest.testCases | Where-Object { $_.status -like 'failed:*' }).Count -gt 0) { exit 1 }
exit 0
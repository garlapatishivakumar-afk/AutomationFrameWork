param(
	[string]$TargetUrl = 'https://inspections-dev.trimont.com/default.aspx',
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

			& node @observerArgs
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
			& node @engineArgs
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

	& node @csharpArgs
	if ($LASTEXITCODE -ne 0) {
		if ($CaseId) { throw "C# generation exited with code $LASTEXITCODE" }
		Write-Warning "C# generation failed. Raw Code.ts and existing post-processing outputs were preserved."
	}
} elseif (-not $SkipCSharpGeneration) {
	if ($CaseId) { throw "C# generator not found: $csharpGeneratorScript" }
	Write-Warning "C# generator not found: $csharpGeneratorScript"
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
	Invoke-CodegenRecording -CodeFile $outputFile -CsFile $csharpOutputFile -ReportFile $csharpReportFile `
		-DomFile $domObservationFile -MetadataFile $tableLocatorMetadataFile -StopFile $csharpStopSignalFile -TargetUrl $TargetUrl
	return
}

# All validation precedes session initialization, browser launch and folder creation.
$ErrorActionPreference = 'Stop'
if ($GenerateOnly -and $SkipCSharpGeneration) { throw '-GenerateOnly cannot be combined with -SkipCSharpGeneration.' }
if ($BatchName -notmatch '^[A-Za-z0-9_-]+$') { throw 'BatchName must contain only letters, digits, underscores or hyphens.' }
function Test-ReservedFolderName([string]$Name) {
	return $Name -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$'
}
if (Test-ReservedFolderName $BatchName) { throw "Reserved Windows folder name: $BatchName" }
$rows = @(Import-Csv -LiteralPath $BatchFile)
if ($rows.Count -eq 0) { throw 'Batch CSV must contain at least one test case.' }
$columns = @('TestCaseId', 'Title', 'StartUrl', 'Preconditions', 'ExpectedResult', 'Priority', 'DataHint')
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
if ($Only -and (Test-Path -LiteralPath $manifestPath)) {
	$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
	if ($manifest.batchId -ne $BatchName -or $null -eq $manifest.testCases) { throw 'Existing manifest has an invalid shape or batchId.' }
}

function Save-BatchManifest {
	# Replace atomically so an interrupted write cannot truncate the previous manifest.
	$tempPath = $manifestPath + '.tmp'
	$json = $manifest | ConvertTo-Json -Depth 20
	[System.IO.File]::WriteAllText($tempPath, $json, (New-Object System.Text.UTF8Encoding($false)))
	if (Test-Path -LiteralPath $manifestPath) {
		[System.IO.File]::Replace($tempPath, $manifestPath, [NullString]::Value)
	} else {
		[System.IO.File]::Move($tempPath, $manifestPath)
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
		folder = $id; codeTs = "$id/Code.ts"; codeCs = "$id/Code.cs"
		report = "$id/CSharpGenerationReport.json"; tableMetadata = "$id/TableLocatorMetadata.json"
		status = 'planned'; actionCount = 0; unsupportedActionCount = 0
		transformedTableActions = 0; recordedAtUtc = $null
	}
	$existing = @($manifest.testCases | Where-Object { $_.id -eq $id })
	if ($GenerateOnly -and $existing.Count -gt 0) { $entry.recordedAtUtc = $existing[0].recordedAtUtc }
	$entries = @($manifest.testCases)
	$index = -1
	for ($i = 0; $i -lt $entries.Count; $i++) { if ($entries[$i].id -eq $id) { $index = $i; break } }
	if ($index -ge 0) { $entries[$index] = $entry } else { $entries += $entry }
	$manifest.testCases = $entries
	New-Item -ItemType Directory -Path (Join-Path $batchFolder $id) -Force | Out-Null
}
Save-BatchManifest
[System.IO.File]::WriteAllText((Join-Path $recordingsRoot 'latest-batch.txt'), "Recordings/$BatchName", (New-Object System.Text.UTF8Encoding($false)))

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
	Write-Host "[$position/$($selectedRows.Count)] $($entry.id) - $($entry.title)"
	Write-Host "  Preconditions: $($entry.preconditions)"
	Write-Host "  ExpectedResult: $($entry.expectedResult)"
	Write-Host "  StartUrl: $($entry.startUrl)"
	if ($DryRun) { Save-BatchManifest; continue }
	if (-not $NoPrompt -and -not $GenerateOnly) {
		$answer = Read-Host 'Press Enter to record, s to skip, q to quit'
		if ($answer -eq 'q') { Save-BatchManifest; break }
		if ($answer -eq 's') { $entry.status = 'skipped'; Save-BatchManifest; continue }
	}
	$caseFolder = Join-Path $batchFolder $entry.id
	$codeFile = Join-Path $caseFolder 'Code.ts'
	$reportFile = Join-Path $caseFolder 'CSharpGenerationReport.json'
	$metadataFile = Join-Path $caseFolder 'TableLocatorMetadata.json'
	if ($GenerateOnly -and -not (Test-Path -LiteralPath $codeFile)) {
		$entry.status = 'skipped'
		Write-Warning "No Code.ts for $($entry.id); skipping regeneration."
		Save-BatchManifest
		continue
	}
	try {
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
		$entry.status = "failed: $($_.Exception.Message)"
		Write-Warning "$($entry.id): $($entry.status)"
	} finally {
		Save-BatchManifest
	}
}
$manifest.testCases | Select-Object id, title, status, @{Name='actions';Expression={$_.actionCount}}, @{Name='unsupported';Expression={$_.unsupportedActionCount}} | Format-Table -AutoSize | Out-Host
if (@($manifest.testCases | Where-Object { $_.status -like 'failed:*' }).Count -gt 0) { exit 1 }
exit 0
function Invoke-CodegenTableLocatorPostProcess {
	param(
		[string]$CodeFilePath,
		[string]$DomFilePath,
		[string]$MetadataFilePath,
		[string]$TableSelector = 'table',
		[switch]$Debug
	)

	if (-not (Test-Path $CodeFilePath)) {
		Write-Warning "Code file not found: $CodeFilePath"
		return
	}

	$scriptDir = Split-Path -Parent $PSCommandPath
	$projectRoot = Resolve-Path (Join-Path $scriptDir "..\..\")
	$engineScript = Join-Path $projectRoot "AIRecorder\Intelligence\TableLocatorIntelligence.cjs"

	if (-not (Test-Path $engineScript)) {
		Write-Warning "Table locator engine not found: $engineScript"
		return
	}

	$arguments = @(
		$engineScript,
		'--code-file', $CodeFilePath,
		'--table-selector', $TableSelector
	)

	if ($DomFilePath) {
		$arguments += @('--dom-file', $DomFilePath)
	}

	if ($MetadataFilePath) {
		$arguments += @('--metadata-file', $MetadataFilePath)
	}

	if ($Debug) {
		$arguments += @('--debug', 'true')
	}

	& node @arguments

	if ($LASTEXITCODE -ne 0) {
		Write-Warning "Table locator intelligence failed. Keeping original Code.ts locators."
	}
}
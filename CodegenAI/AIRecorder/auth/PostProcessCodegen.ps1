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

	function Resolve-TableLocatorEngineScript {
		param([string]$StartDir)

		$probe = Resolve-Path $StartDir
		while ($probe) {
			$candidate = Join-Path $probe "AIRecorder\Intelligence\TableLocatorIntelligence.cjs"
			if (Test-Path $candidate) {
				return $candidate
			}

			$candidate = Join-Path $probe "Intelligence\TableLocatorIntelligence.cjs"
			if (Test-Path $candidate) {
				return $candidate
			}

			$parent = Split-Path -Parent $probe
			if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $probe) {
				break
			}
			$probe = $parent
		}

		return $null
	}

	$scriptDir = Split-Path -Parent $PSCommandPath
	$engineScript = Resolve-TableLocatorEngineScript -StartDir $scriptDir

	if ([string]::IsNullOrWhiteSpace($engineScript) -or (-not (Test-Path $engineScript))) {
		Write-Warning "Table locator engine not found from start directory: $scriptDir"
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
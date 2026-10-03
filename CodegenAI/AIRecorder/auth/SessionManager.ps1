function Test-CodegenSessionValid {
	param(
		[string]$Path,
		[int]$MaxAgeDays
	)

	if (-not (Test-Path $Path)) {
		return $false
	}

	$fileInfo = Get-Item $Path
	if ($fileInfo.Length -le 0) {
		return $false
	}

	$maxAge = [TimeSpan]::FromDays($MaxAgeDays)
	return ((Get-Date) - $fileInfo.LastWriteTimeUtc) -le $maxAge
}

function Initialize-CodegenSession {
	param(
		[string]$SessionPath,
		[int]$MaxAgeDays
	)

	$sessionDir = Split-Path -Parent $SessionPath
	if (-not (Test-Path $sessionDir)) {
		New-Item -ItemType Directory -Path $sessionDir -Force | Out-Null
	}

	if (-not (Test-CodegenSessionValid -Path $SessionPath -MaxAgeDays $MaxAgeDays)) {
		if (Test-Path $SessionPath) {
			Remove-Item $SessionPath -Force
		}
	}
}

function Get-CodegenArgs {
	param(
		[string]$TargetUrl,
		[string]$OutputFile,
		[string]$SessionPath,
		[string]$TestIdAttribute,
		[bool]$LoadSession
	)

	$args = @(
		'playwright', 'codegen'
	)

	if ($LoadSession) {
		$args += @('--load-storage', $SessionPath)
	}

	$args += @(
		'--test-id-attribute', $TestIdAttribute,
		$TargetUrl,
		'-o', $OutputFile,
		'--save-storage', $SessionPath
	)

	return $args
}
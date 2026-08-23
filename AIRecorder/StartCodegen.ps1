# Configure codegen start URL here.
$StartUrl = "https://documentadministration-uat.trimont.com/"
$ApplicationKey = "DocAdmin"
$OutputFile = "Code.ts"

# V2.1 Enhancement #1: load pure URL naming functions
. "$PSScriptRoot\UrlNamingFunctions.ps1"

function Ensure-UrlsApplicationsNode {
	param([Parameter(Mandatory = $true)]$Config)

	if (-not $Config.Urls) {
		$Config | Add-Member -MemberType NoteProperty -Name Urls -Value ([pscustomobject]@{})
	}

	if (-not $Config.Urls.Applications) {
		$Config.Urls | Add-Member -MemberType NoteProperty -Name Applications -Value ([pscustomobject]@{})
	}
}

function Set-ApplicationUrl {
	param(
		[Parameter(Mandatory = $true)]$Config,
		[Parameter(Mandatory = $true)][string]$Key,
		[Parameter(Mandatory = $true)][string]$Url
	)

	$existingProperty = $Config.Urls.Applications.PSObject.Properties[$Key]
	if ($null -ne $existingProperty) {
		$Config.Urls.Applications.$Key = $Url
	}
	else {
		$Config.Urls.Applications | Add-Member -MemberType NoteProperty -Name $Key -Value $Url
	}
}

function Get-NormalizedUrl {
	param([Parameter(Mandatory = $true)][string]$Url)

	return $Url.Trim().TrimEnd('/').ToLowerInvariant()
}

function Add-RecordedUrlsToConfig {
	param(
		[Parameter(Mandatory = $true)]$Config,
		[Parameter(Mandatory = $true)][string]$RecordedCodePath
	)

	if (-not (Test-Path $RecordedCodePath)) {
		Write-Host "Recorded code file not found at $RecordedCodePath. Skipping URL discovery."
		return
	}

	$codeContent = Get-Content -Path $RecordedCodePath -Raw
	$urlMatches = [regex]::Matches($codeContent, 'https?://[^\s"''`]+') | ForEach-Object { $_.Value.TrimEnd(')', ',', ';') }
	$uniqueUrls = $urlMatches | Sort-Object -Unique

	if (-not $uniqueUrls -or $uniqueUrls.Count -eq 0) {
		Write-Host "No additional URLs found in recorded code."
		return
	}

	$existingValues = @{}
	foreach ($prop in $Config.Urls.Applications.PSObject.Properties) {
		if ($prop.Value -is [string] -and -not [string]::IsNullOrWhiteSpace($prop.Value)) {
			$existingValues[(Get-NormalizedUrl $prop.Value)] = $true
		}
	}

	$index = 1
	foreach ($discoveredUrl in $uniqueUrls) {
		$normalized = Get-NormalizedUrl $discoveredUrl
		if ($existingValues.ContainsKey($normalized)) {
			continue
		}

		while ($Config.Urls.Applications.PSObject.Properties["RecordedUrl$index"]) {
			$index++
		}

		$generatedKey = "RecordedUrl$index"
		Set-ApplicationUrl -Config $Config -Key $generatedKey -Url $discoveredUrl
		$existingValues[$normalized] = $true
		Write-Host "Added discovered URL: Urls.Applications.$generatedKey = $discoveredUrl"
		$index++
	}
}

Write-Host "Starting Playwright Codegen..."

$projectRoot = Split-Path $PSScriptRoot -Parent
$appSettingsPath = Join-Path $projectRoot "appsettings.json"
$outputPath = Join-Path $PSScriptRoot $OutputFile

if (-not (Test-Path $appSettingsPath)) {
	throw "appsettings.json not found at $appSettingsPath"
}

$config = Get-Content -Path $appSettingsPath -Raw | ConvertFrom-Json
Ensure-UrlsApplicationsNode -Config $config
Set-ApplicationUrl -Config $config -Key $ApplicationKey -Url $StartUrl

$config | ConvertTo-Json -Depth 20 | Set-Content -Path $appSettingsPath -Encoding UTF8
Write-Host "Updated appsettings URL: Urls.Applications.$ApplicationKey = $StartUrl"

npx playwright codegen $StartUrl -o $outputPath

$config = Get-Content -Path $appSettingsPath -Raw | ConvertFrom-Json
Ensure-UrlsApplicationsNode -Config $config
Add-RecordedUrlsToConfig -Config $config -RecordedCodePath $outputPath

# V2.1 Enhancement #1: single authoritative semantic mapping pass over all RecordedUrlN entries
# Processes both pre-existing and newly added entries. Idempotent - safe to run repeatedly.
foreach ($prop in @($config.Urls.Applications.PSObject.Properties)) {
	if ($prop.Name -match '^RecordedUrl\d+$' -and $prop.Value -is [string] -and
	    -not [string]::IsNullOrWhiteSpace($prop.Value)) {
		$appName  = Get-AppNameFromUrl  -Url $prop.Value
		$pageName = Get-PageNameFromUrl -Url $prop.Value
		if (-not [string]::IsNullOrWhiteSpace($appName) -and
		    -not [string]::IsNullOrWhiteSpace($pageName)) {
			Set-RecordedApplication -Config $config -AppName $appName -PageName $pageName -Url $prop.Value
		}
		else {
			Write-Host "Skipped semantic mapping (app/page undetermined): $($prop.Value)"
		}
	}
}

$config | ConvertTo-Json -Depth 20 | Set-Content -Path $appSettingsPath -Encoding UTF8

# V2.1 Enhancement #2: run static DOM analysis to populate LiveObservations.json
$liveObserverPath = Join-Path $projectRoot "AISetup\AIRecorder\LiveObserver.ts"
if (Test-Path $liveObserverPath) {
	Write-Host "Running LiveObserver (static DOM analysis)..."
	npx ts-node $liveObserverPath
} else {
	Write-Host "LiveObserver not found at $liveObserverPath — skipping DOM analysis."
}

Write-Host "Codegen Closed"
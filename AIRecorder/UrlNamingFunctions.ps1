# V2.1 Enhancement #1 - URL naming functions
# Pure functions only. No side effects. Safe to dot-source independently.
# Do NOT add recorder invocation, file I/O, or appsettings logic here.

function Get-AppNameFromUrl {
	param([Parameter(Mandatory = $true)][string]$Url)

	try {
		$hostname = ([System.Uri]$Url).Host.ToLowerInvariant()

		if ($hostname -like 'cashmanagement*')          { return 'CashManagement' }
		if ($hostname -like 'investorreporting*')       { return 'InvestorReporting' }
		if ($hostname -like 'documentadministration*')  { return 'DocumentAdministration' }

		# login.microsoftonline.com and all unknown hosts -> no mapping
		return $null
	}
	catch { return $null }
}

function Get-PageNameFromUrl {
	param([Parameter(Mandatory = $true)][string]$Url)

	try {
		$path = ([System.Uri]$Url).AbsolutePath.TrimEnd('/')
		if ([string]::IsNullOrWhiteSpace($path) -or $path -eq '/') { return $null }

		# Last path segment only; AbsolutePath excludes query string
		$lastSegment = [System.IO.Path]::GetFileNameWithoutExtension($path.Split('/')[-1])
		if ([string]::IsNullOrWhiteSpace($lastSegment)) { return $null }

		# Remove known technical prefixes: dg, frm, pg
		$cleaned = $lastSegment -replace '^dg', '' `
		                        -replace '^frm', '' `
		                        -replace '^pg', ''

		if ([string]::IsNullOrWhiteSpace($cleaned)) { return $null }

		# Ensure PascalCase: capitalize first letter
		return $cleaned.Substring(0, 1).ToUpper() + $cleaned.Substring(1)
	}
	catch { return $null }
}

function Set-RecordedApplication {
	param(
		[Parameter(Mandatory = $true)]$Config,
		[Parameter(Mandatory = $true)][string]$AppName,
		[Parameter(Mandatory = $true)][string]$PageName,
		[Parameter(Mandatory = $true)][string]$Url
	)

	# Ensure Urls.Applications.RecordedApplications node exists
	if (-not $Config.Urls.Applications.PSObject.Properties['RecordedApplications']) {
		$Config.Urls.Applications | Add-Member -MemberType NoteProperty `
			-Name 'RecordedApplications' -Value ([pscustomobject]@{})
	}

	$recorded = $Config.Urls.Applications.RecordedApplications

	# Ensure application node exists
	if (-not $recorded.PSObject.Properties[$AppName]) {
		$recorded | Add-Member -MemberType NoteProperty `
			-Name $AppName -Value ([pscustomobject]@{})
	}

	$appNode = $recorded.$AppName

	# Upsert page -> URL (idempotent)
	if ($appNode.PSObject.Properties[$PageName]) {
		$appNode.$PageName = $Url
	}
	else {
		$appNode | Add-Member -MemberType NoteProperty -Name $PageName -Value $Url
	}

	Write-Host "Mapped: RecordedApplications.$AppName.$PageName = $Url"
}

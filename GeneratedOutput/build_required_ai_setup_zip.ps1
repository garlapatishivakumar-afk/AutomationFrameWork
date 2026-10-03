$ErrorActionPreference = 'Stop'

$workspace = (Get-Location).Path
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$staging = Join-Path $workspace ("GeneratedOutput\AI-Setup-Required-Package_" + $timestamp)
$root = Join-Path $staging 'AI-Setup'
$zipPath = Join-Path $workspace ("GeneratedOutput\AI-Setup-Required-V1.0-to-V7.0_" + $timestamp + '.zip')

if (Test-Path $staging) {
  Remove-Item -Recurse -Force $staging
}
New-Item -ItemType Directory -Path $root | Out-Null

$versions = @(
  @{ V = 'V1.0'; B = 'Ai_Automation_Version_1.0' },
  @{ V = 'V2.0'; B = 'Ai_Automation_Version_2.0' },
  @{ V = 'V3.0'; B = 'Ai_Automation_Version_3.0' },
  @{ V = 'V4.0'; B = 'Ai_Automation_Version_4.0' },
  @{ V = 'V5.0'; B = 'Ai_Automation_Version_5.0' },
  @{ V = 'V6.0'; B = 'Ai_Automation_Version_6.0' },
  @{ V = 'V7.0'; B = 'Ai_Automation_Version_7.0' }
)

$requiredPrefixes = @(
  'AISetup/',
  'AIRecorder/',
  'AIAutomationGenerator.Runner/',
  'DriverFactory/',
  'Helpers/',
  'Hooks/',
  'PageActions/',
  'PageElements/',
  'Utilities/',
  'config/'
)

$requiredFiles = @(
  'AutomationFrameWork.csproj',
  'AutomationFrameWork.sln',
  'AutomationFrameWork.slnf',
  'AutomationFrameWork.only.slnf',
  'reqnroll.json',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'appsettings.json',
  'ImplicitUsings.cs',
  'XunitAssembly.cs',
  'BusinessDictionary.json',
  'Code.cs',
  'ContextCache.json',
  'RepositoryIndex.json'
)

$allowedExt = @(
  '.cs', '.ts', '.js', '.json', '.md', '.txt', '.ps1', '.csproj', '.sln', '.slnf',
  '.props', '.targets', '.feature', '.xml', '.yml', '.yaml', '.config'
)

$excludeRegex = '(?i)(^|/)(node_modules|bin|obj|traces?|reports?|screenshots?|videos?|test-results|coverage|logs?|temp|cache|generatedoutput|metadataoutput|browser-session)(/|$)|(^|/)(.*\.log$)|(^|/)\.env$|(^|/)~\$'

$summary = @()

foreach ($item in $versions) {
  $vDir = Join-Path $root $item.V
  New-Item -ItemType Directory -Path $vDir | Out-Null

  $all = git ls-tree -r --name-only $item.B
  if (-not $all) {
    throw "No files found for branch $($item.B)"
  }

  $loginPick = $all |
    Where-Object { $_ -match '^(Tests|Features|StepDefinitions)/' -and $_ -match '(?i)login|auth|signin|sign-in|smoke|sanity' } |
    Select-Object -First 1

  if (-not $loginPick) {
    $loginPick = $all |
      Where-Object { $_ -match '^(Tests|Features|StepDefinitions)/' } |
      Select-Object -First 1
  }

  $selected = New-Object System.Collections.Generic.List[string]

  foreach ($f in $all) {
    $fNorm = $f -replace '\\', '/'

    if ($fNorm -match $excludeRegex) {
      continue
    }

    $isRequiredPath = $false
    foreach ($p in $requiredPrefixes) {
      if ($fNorm.StartsWith($p)) {
        $isRequiredPath = $true
        break
      }
    }

    if (-not $isRequiredPath -and ($requiredFiles -notcontains $fNorm)) {
      continue
    }

    if ($fNorm -match '^(Tests|Features|StepDefinitions)/') {
      continue
    }

    $ext = [System.IO.Path]::GetExtension($fNorm).ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($ext) -or ($allowedExt -contains $ext)) {
      $selected.Add($fNorm)
    }
  }

  if ($loginPick) {
    $loginExt = [System.IO.Path]::GetExtension($loginPick)
    if ([string]::IsNullOrWhiteSpace($loginExt)) {
      $loginExt = '.txt'
    }

    $loginDir = Join-Path $vDir 'Tests\Login'
    New-Item -ItemType Directory -Path $loginDir -Force | Out-Null
    $loginTarget = Join-Path $loginDir ('Login' + $loginExt)
    git show ($item.B + ':' + $loginPick) | Out-File -FilePath $loginTarget -Encoding utf8
  }

  foreach ($f in ($selected | Sort-Object -Unique)) {
    $dest = Join-Path $vDir ($f -replace '/', '\\')
    $destParent = Split-Path $dest -Parent
    if (-not (Test-Path $destParent)) {
      New-Item -ItemType Directory -Path $destParent -Force | Out-Null
    }
    git show ($item.B + ':' + $f) | Out-File -FilePath $dest -Encoding utf8
  }

  $count = (Get-ChildItem -Path $vDir -Recurse -File | Measure-Object).Count
  $loginSource = 'NONE'
  if ($loginPick) { $loginSource = $loginPick }

  $summary += [pscustomobject]@{
    Version      = $item.V
    Branch       = $item.B
    FilesIncluded= $count
    LoginSource  = $loginSource
  }

  Write-Output ("PACKAGED=" + $item.V + ";FILES=" + $count + ";LOGIN_SOURCE=" + $loginSource)
}

$summaryPath = Join-Path $root 'PACKAGE_SUMMARY.txt'
$summary | Format-Table -AutoSize | Out-String | Out-File -FilePath $summaryPath -Encoding utf8

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -Force

Write-Output ("ZIP_PATH=" + $zipPath)
Write-Output ("STAGING_PATH=" + $staging)
Write-Output ("SUMMARY_PATH=" + $summaryPath)

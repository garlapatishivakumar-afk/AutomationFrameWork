[CmdletBinding()]
param(
    [string]$ExtensionsRoot = (Join-Path $env:USERPROFILE '.vscode\extensions'),
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$folderName = 'local.tll-highlighter-0.1.0'
$root = [System.IO.Path]::GetFullPath($ExtensionsRoot)
$destination = Join-Path $root $folderName
$source = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\', '/')

# Never remove the source or its ancestor, even with a mistaken custom root.
if ($source.Equals($destination, [System.StringComparison]::OrdinalIgnoreCase) -or
    $source.StartsWith($destination + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or
    $destination.StartsWith($source + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'The extension destination must be outside the source folder and cannot contain it.'
}
if (Test-Path -LiteralPath $destination) {
    $existing = Get-Item -LiteralPath $destination -Force
    if (($existing.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Refusing to replace a linked extension folder.'
    }
}

if ($Uninstall) {
    if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
    Write-Output "Removed (if present): $destination"
} else {
    # Check source first so an incomplete checkout cannot destroy an installed copy.
    foreach ($required in @('package.json', 'extension.js', 'highlightLogic.js')) {
        if (-not (Test-Path -LiteralPath (Join-Path $source $required) -PathType Leaf)) {
            throw "Missing extension source file: $required"
        }
    }
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $destination -Recurse -Force
    Write-Output "Copied extension to: $destination"
}
Write-Output 'Reload the VS Code window'
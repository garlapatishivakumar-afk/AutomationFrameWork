Write-Host "Starting Playwright Codegen..."

$projectRoot = Split-Path $PSScriptRoot -Parent

npx playwright codegen `
"https://investorreporting-mb-sit.trimont.com/default.aspx" `
-o "$projectRoot\AIRecorder\Code.ts"

Write-Host "Codegen closed."
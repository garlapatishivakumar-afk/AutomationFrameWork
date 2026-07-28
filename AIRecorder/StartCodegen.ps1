Write-Host "Starting Playwright Codegen..."

$projectRoot = Split-Path $PSScriptRoot -Parent

npx playwright codegen `
"https://cashmanagement-sit.trimont.com/Whoiam.aspx" `
-o "$projectRoot\AIRecorder\Code.ts"

Write-Host "Codegen Closed"
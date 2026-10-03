$ErrorActionPreference = 'Stop'

$repoRoot = (Get-Location).Path
$worktreeRoot = Join-Path $repoRoot 'GeneratedOutput\version-worktrees'
New-Item -ItemType Directory -Path $worktreeRoot -Force | Out-Null

$versions = @(
    @{ Version = 'V2.0'; Branch = 'Ai_Automation_Version_2.0' },
    @{ Version = 'V3.0'; Branch = 'Ai_Automation_Version_3.0' },
    @{ Version = 'V4.0'; Branch = 'Ai_Automation_Version_4.0' },
    @{ Version = 'V5.0'; Branch = 'Ai_Automation_Version_5.0' },
    @{ Version = 'V6.0'; Branch = 'Ai_Automation_Version_6.0' },
    @{ Version = 'V7.0'; Branch = 'Ai_Automation_Version_7.0' }
)

$templateUploadDir = Join-Path $repoRoot 'AIRecorder\Upload'

$importNeedle = 'import { ReviewResult } from "../Review/ReviewResult";'
$importInsert = @'
import { ReviewResult } from "../Review/ReviewResult";
import { UploadAssetManager } from "../Upload/UploadAssetManager";
'@

$fieldNeedle = @'
    private readonly autoFix =
        new AutoFixEngine();

    private readonly questionEngine =
        new QuestionEngine();
'@

$fieldInsert = @'
    private readonly autoFix =
        new AutoFixEngine();

    private readonly uploadAssets =
        new UploadAssetManager(process.cwd());

    private readonly questionEngine =
        new QuestionEngine();
'@

$runNeedle = @'
    public async run(input: GenerationPipelineInput): Promise<GenerationResult> {

        const context: WorkflowContext = {
'@

$runInsert = @'
    public async run(input: GenerationPipelineInput): Promise<GenerationResult> {

        const uploadResult =
            this.uploadAssets.processCodeFile("AIRecorder/code.ts");

        if (uploadResult.hasUpload) {
            const copied = uploadResult.stagedFiles.join(", ");
            console.log(`[Upload] detected in ${uploadResult.codeFilePath}; copied: ${copied || "none"}; rewritten: ${uploadResult.modifiedCode}`);
        }

        const context: WorkflowContext = {
'@

foreach ($item in $versions) {
    $wtPath = Join-Path $worktreeRoot $item.Version

    if (-not (Test-Path $wtPath)) {
        git worktree add "$wtPath" $item.Branch | Out-Null
    }

    $targetUploadDir = Join-Path $wtPath 'AISetup\AIRecorder\Upload'
    New-Item -ItemType Directory -Path $targetUploadDir -Force | Out-Null

    Copy-Item (Join-Path $templateUploadDir 'UploadDetector.ts') (Join-Path $targetUploadDir 'UploadDetector.ts') -Force
    Copy-Item (Join-Path $templateUploadDir 'UploadFileResolver.ts') (Join-Path $targetUploadDir 'UploadFileResolver.ts') -Force
    Copy-Item (Join-Path $templateUploadDir 'UploadPathGenerator.ts') (Join-Path $targetUploadDir 'UploadPathGenerator.ts') -Force
    Copy-Item (Join-Path $templateUploadDir 'UploadAssetManager.ts') (Join-Path $targetUploadDir 'UploadAssetManager.ts') -Force
    Copy-Item (Join-Path $templateUploadDir 'UploadAssetManager.test.ts') (Join-Path $targetUploadDir 'UploadAssetManager.test.ts') -Force

    $pipelinePath = Join-Path $wtPath 'AISetup\AIRecorder\Integration\GenerationPipeline.ts'
    $pipeline = Get-Content $pipelinePath -Raw

    if ($pipeline -notmatch 'UploadAssetManager') {
        $pipeline = $pipeline.Replace($importNeedle, $importInsert.TrimEnd())
    }

    if ($pipeline -notmatch 'private readonly uploadAssets') {
        $pipeline = $pipeline.Replace($fieldNeedle, $fieldInsert.TrimEnd())
    }

    if ($pipeline -notmatch 'processCodeFile\("AIRecorder/code.ts"\)') {
        $pipeline = $pipeline.Replace($runNeedle, $runInsert.TrimEnd())
    }

    Set-Content -Path $pipelinePath -Value $pipeline -Encoding UTF8

    Push-Location $wtPath
    try {
        npx tsc --noEmit | Out-Null

        $out = Join-Path $wtPath 'GeneratedOutput\upload-tests'
        if (Test-Path $out) {
            Remove-Item -Recurse -Force $out
        }

        npx tsc --ignoreConfig AISetup/AIRecorder/Upload/UploadAssetManager.test.ts AISetup/AIRecorder/Upload/UploadAssetManager.ts AISetup/AIRecorder/Upload/UploadDetector.ts AISetup/AIRecorder/Upload/UploadFileResolver.ts AISetup/AIRecorder/Upload/UploadPathGenerator.ts --outDir "$out" --module NodeNext --target ES2020 --moduleResolution NodeNext --esModuleInterop --types node | Out-Null

        node (Join-Path $out 'UploadAssetManager.test.js') | Out-Null

        git add AISetup/AIRecorder/Upload AISetup/AIRecorder/Integration/GenerationPipeline.ts
        if ((git status --short).Length -gt 0) {
            git commit -m "Add centralized upload asset handling for generated code" | Out-Null
        }

        Write-Output ("UPDATED=" + $item.Version)
    }
    finally {
        Pop-Location
    }
}

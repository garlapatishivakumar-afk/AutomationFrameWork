import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DownloadManager } from "./DownloadManager";

function makeTempDir(name: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

function write(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
}

function runAll(): void {
    testInjectsDownloadRuntimeCall();
    testNoDownloadNoChanges();
    testSaveAsLineIsRemoved();
    testFolderCreatedAtRuntimeOnly();
    testUnknownFormatHandledByRuntimeCompile();
    console.log("DownloadManager tests: PASS");
}

function testInjectsDownloadRuntimeCall(): void {
    const root = makeTempDir("download-inject");
    write(
        path.join(root, "AIRecorder", "code.ts"),
        [
            "import { test } from '@playwright/test';",
            "test('d', async ({ page }) => {",
            "  const downloadPromise = page.waitForEvent('download');",
            "  await page.getByRole('button', { name: 'Any' }).click();",
            "  const download = await downloadPromise;",
            "});"
        ].join("\n")
    );

    const manager = new DownloadManager(root);
    const result = manager.processCodeFile("AIRecorder/code.ts");

    assert.equal(result.hasDownload, true);
    assert.equal(result.instrumentedDownloads, 1);

    const code = fs.readFileSync(path.join(root, "AIRecorder", "code.ts"), "utf8");
    assert.equal(code.includes('import { processFrameworkDownload } from "./Download/DownloadRuntime";'), true);
    assert.equal(code.includes("await processFrameworkDownload(download);"), true);
}

function testNoDownloadNoChanges(): void {
    const root = makeTempDir("download-none");
    const codePath = path.join(root, "AIRecorder", "code.ts");
    write(codePath, "await page.goto('https://example.com');\n");

    const manager = new DownloadManager(root);
    const result = manager.processCodeFile("AIRecorder/code.ts");

    assert.equal(result.hasDownload, false);
    assert.equal(result.modifiedCode, false);
    assert.equal(fs.readFileSync(codePath, "utf8"), "await page.goto('https://example.com');\n");
}

function testSaveAsLineIsRemoved(): void {
    const root = makeTempDir("download-saveas");
    write(
        path.join(root, "AIRecorder", "code.ts"),
        [
            "import { test } from '@playwright/test';",
            "test('d', async ({ page }) => {",
            "  const downloadPromise = page.waitForEvent('download');",
            "  await page.getByRole('button', { name: 'Any' }).click();",
            "  const download = await downloadPromise;",
            "  await download.saveAs('C:/temp/file.txt');",
            "});"
        ].join("\n")
    );

    const manager = new DownloadManager(root);
    manager.processCodeFile("AIRecorder/code.ts");

    const code = fs.readFileSync(path.join(root, "AIRecorder", "code.ts"), "utf8");
    assert.equal(code.includes("await download.saveAs("), false);
}

function testFolderCreatedAtRuntimeOnly(): void {
    const root = makeTempDir("download-folder");
    write(
        path.join(root, "AIRecorder", "code.ts"),
        [
            "import { test } from '@playwright/test';",
            "test('d', async ({ page }) => {",
            "  const downloadPromise = page.waitForEvent('download');",
            "  await page.getByRole('button', { name: 'Any' }).click();",
            "  const download = await downloadPromise;",
            "});"
        ].join("\n")
    );

    const manager = new DownloadManager(root);
    manager.processCodeFile("AIRecorder/code.ts");

    assert.equal(fs.existsSync(path.join(root, "Downloads")), false);
}

function testUnknownFormatHandledByRuntimeCompile(): void {
    const root = makeTempDir("download-unknown");
    write(
        path.join(root, "AIRecorder", "code.ts"),
        [
            "import { test } from '@playwright/test';",
            "test('d', async ({ page }) => {",
            "  const downloadPromise = page.waitForEvent('download');",
            "  await page.getByRole('button', { name: 'Any' }).click();",
            "  const download = await downloadPromise;",
            "});"
        ].join("\n")
    );

    const manager = new DownloadManager(root);
    manager.processCodeFile("AIRecorder/code.ts");

    const code = fs.readFileSync(path.join(root, "AIRecorder", "code.ts"), "utf8");
    assert.equal(code.includes("processFrameworkDownload(download)"), true);
}

runAll();

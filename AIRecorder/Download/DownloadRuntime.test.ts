import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { processFrameworkDownload } from "./DownloadRuntime";
import { detectDownloadFormat } from "./DownloadFormatDetector";

interface FakeDownloadOptions {
    fileName: string;
    content?: string;
    failureReason?: string | null;
}

function makeTempDir(name: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

function makeFakeDownload(options: FakeDownloadOptions) {
    return {
        suggestedFilename(): string {
            return options.fileName;
        },
        async failure(): Promise<string | null> {
            return options.failureReason ?? null;
        },
        async saveAs(filePath: string): Promise<void> {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, options.content ?? "downloaded", "utf8");
        }
    };
}

async function withTempCwd<T>(name: string, callback: (root: string) => Promise<T>): Promise<T> {
    const root = makeTempDir(name);
    const previous = process.cwd();
    process.chdir(root);

    try {
        return await callback(root);
    } finally {
        process.chdir(previous);
    }
}

async function testBasicDownloadAndCleanup(): Promise<void> {
    await withTempCwd("download-basic", async (root) => {
        await processFrameworkDownload(
            makeFakeDownload({ fileName: "CustomerData.csv", content: "id,name\n1,a" }),
            "CSV"
        );

        const downloadsDir = path.join(root, "Downloads");
        assert.equal(fs.existsSync(downloadsDir), true);
        const files = fs.readdirSync(downloadsDir);
        assert.equal(files.length, 0);
    });
}

async function testReusesExistingDownloadsFolder(): Promise<void> {
    await withTempCwd("download-reuse", async (root) => {
        const downloadsDir = path.join(root, "Downloads");
        fs.mkdirSync(downloadsDir, { recursive: true });
        fs.writeFileSync(path.join(downloadsDir, "existing.txt"), "keep", "utf8");

        await processFrameworkDownload(makeFakeDownload({ fileName: "Report.pdf", content: "pdf" }), "PDF");

        assert.equal(fs.existsSync(path.join(downloadsDir, "existing.txt")), true);
    });
}

async function testFailureReportsAndCleansUp(): Promise<void> {
    await withTempCwd("download-failure", async (root) => {
        let failed = false;

        try {
            await processFrameworkDownload(makeFakeDownload({ fileName: "Broken.xlsx", failureReason: "network error" }));
        } catch (error) {
            failed = true;
            assert.equal(String((error as Error).message).includes("Playwright reported download failure"), true);
        }

        assert.equal(failed, true);
        const downloadsDir = path.join(root, "Downloads");
        if (fs.existsSync(downloadsDir)) {
            const files = fs.readdirSync(downloadsDir);
            assert.equal(files.length, 0);
        }
    });
}

async function testEmptyFileFailsAndCleansUp(): Promise<void> {
    await withTempCwd("download-empty", async (root) => {
        let failed = false;

        try {
            await processFrameworkDownload(makeFakeDownload({ fileName: "Empty.txt", content: "" }), "TXT");
        } catch (error) {
            failed = true;
            assert.equal(String((error as Error).message).includes("empty"), true);
        }

        assert.equal(failed, true);

        const downloadsDir = path.join(root, "Downloads");
        assert.equal(fs.existsSync(downloadsDir), true);
        assert.equal(fs.readdirSync(downloadsDir).length, 0);
    });
}

function testFormatDetection(): void {
    assert.equal(detectDownloadFormat("a.txt"), "TXT");
    assert.equal(detectDownloadFormat("a.csv"), "CSV");
    assert.equal(detectDownloadFormat("a.xlsx"), "XLSX");
    assert.equal(detectDownloadFormat("a.pdf"), "PDF");
    assert.equal(detectDownloadFormat("a.unknownext"), "UNKNOWN");
}

async function runAll(): Promise<void> {
    await testBasicDownloadAndCleanup();
    await testReusesExistingDownloadsFolder();
    await testFailureReportsAndCleansUp();
    await testEmptyFileFailsAndCleansUp();
    testFormatDetection();
    console.log("DownloadRuntime tests: PASS");
}

runAll();

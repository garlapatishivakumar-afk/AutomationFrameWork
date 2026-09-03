import fs from "node:fs";
import path from "node:path";
import { deleteDownloadedFile } from "./DownloadCleanup";
import { detectDownloadFormat } from "./DownloadFormatDetector";
import { validateDownloadedFile } from "./DownloadValidator";

export interface DownloadLike {
    suggestedFilename(): string;
    saveAs(filePath: string): Promise<void>;
    failure?(): Promise<string | null>;
}

function sanitizeFileName(fileName: string): string {
    const trimmed = fileName.trim();
    if (trimmed.length === 0) {
        return "download.bin";
    }

    const cleaned = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    return cleaned.length === 0 ? "download.bin" : cleaned;
}

function nextAvailablePath(downloadsDir: string, fileName: string): string {
    const parsed = path.parse(fileName);
    let candidate = path.join(downloadsDir, fileName);
    let counter = 2;

    while (fs.existsSync(candidate)) {
        candidate = path.join(downloadsDir, `${parsed.name}_${counter}${parsed.ext}`);
        counter += 1;
    }

    return candidate;
}

function bytesLabel(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const kb = bytes / 1024;
    if (kb < 1024) {
        return `${kb.toFixed(1)} KB`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
}

function frameworkRelativePath(absolutePath: string): string {
    const rel = path.relative(process.cwd(), absolutePath).replace(/\\/g, "/");
    return rel.length > 0 ? rel : absolutePath;
}

function printPass(fileName: string, format: string, relativePath: string, sizeBytes: number, formatValid: boolean): void {
    console.log("========== DOWNLOAD VALIDATION ==========");
    console.log("");
    console.log("Download Status : PASS");
    console.log(`File Name       : ${fileName}`);
    console.log(`File Format     : ${format}`);
    console.log(`File Path       : ${relativePath}`);
    console.log("File Exists     : PASS");
    console.log(`File Size       : ${bytesLabel(sizeBytes)}`);
    console.log(`Format Valid    : ${formatValid ? "PASS" : "FAIL"}`);
    console.log("");
    console.log("=========================================");
}

function printFail(fileName: string, format: string, relativePath: string, reason: string): void {
    console.log("========== DOWNLOAD VALIDATION ==========");
    console.log("");
    console.log("Download Status : FAIL");
    console.log(`File Name       : ${fileName}`);
    console.log(`File Format     : ${format}`);
    if (relativePath) {
        console.log(`File Path       : ${relativePath}`);
    }
    console.log("File Exists     : FAIL");
    console.log(`Reason          : ${reason}`);
    console.log("");
    console.log("=========================================");
}

export async function processFrameworkDownload(download: DownloadLike, expectedFormat?: string): Promise<void> {
    let savedPath: string | undefined;
    let relativePath = "";
    let fileName = "download.bin";
    let format = "UNKNOWN";

    try {
        if (!download) {
            throw new Error("Download object is null or undefined.");
        }

        const failureReason = download.failure ? await download.failure() : null;
        if (failureReason) {
            throw new Error(`Playwright reported download failure: ${failureReason}`);
        }

        const downloadsDir = path.resolve(process.cwd(), "Downloads");
        fs.mkdirSync(downloadsDir, { recursive: true });

        fileName = sanitizeFileName(download.suggestedFilename());
        format = detectDownloadFormat(fileName);

        savedPath = nextAvailablePath(downloadsDir, fileName);
        relativePath = frameworkRelativePath(savedPath);

        await download.saveAs(savedPath);

        const validation = validateDownloadedFile(savedPath, format, expectedFormat);
        if (!validation.exists) {
            throw new Error("Downloaded file was not found.");
        }

        if (validation.sizeBytes <= 0) {
            throw new Error("Downloaded file is empty.");
        }

        if (!validation.formatValid) {
            throw new Error(
                `Downloaded file format mismatch. Expected ${expectedFormat?.toUpperCase()} but got ${validation.format}.`
            );
        }

        printPass(fileName, validation.format, relativePath, validation.sizeBytes, validation.formatValid);
    } catch (error) {
        const reason = (error as Error).message || "Unknown download validation failure.";
        printFail(fileName, format, relativePath, reason);
        throw error;
    } finally {
        deleteDownloadedFile(savedPath);
    }
}

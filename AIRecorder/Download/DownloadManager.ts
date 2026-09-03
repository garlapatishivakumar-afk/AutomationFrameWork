import fs from "node:fs";
import path from "node:path";
import { detectDownloadOperations, hasDownloadWaitEvent } from "./DownloadDetector";

export interface DownloadProcessingResult {
    hasDownload: boolean;
    modifiedCode: boolean;
    instrumentedDownloads: number;
    codeFilePath: string;
}

export class DownloadManager {
    public constructor(private readonly frameworkRoot: string = process.cwd()) {
    }

    public processCodeFile(relativeCodePath: string = path.join("AIRecorder", "code.ts")): DownloadProcessingResult {
        const codeFilePath = path.join(this.frameworkRoot, relativeCodePath);

        if (!fs.existsSync(codeFilePath)) {
            return {
                hasDownload: false,
                modifiedCode: false,
                instrumentedDownloads: 0,
                codeFilePath
            };
        }

        const originalCode = fs.readFileSync(codeFilePath, "utf8");
        if (!hasDownloadWaitEvent(originalCode)) {
            return {
                hasDownload: false,
                modifiedCode: false,
                instrumentedDownloads: 0,
                codeFilePath
            };
        }

        const operations = detectDownloadOperations(originalCode);
        if (operations.length === 0) {
            return {
                hasDownload: true,
                modifiedCode: false,
                instrumentedDownloads: 0,
                codeFilePath
            };
        }

        let rewrittenCode = this.ensureRuntimeImport(originalCode);
        let instrumentedDownloads = 0;

        const reversed = [...operations].reverse();
        for (const op of reversed) {
            const callLine = `\n  await processFrameworkDownload(${op.downloadVariable});`;
            const tail = rewrittenCode.slice(op.assignmentEnd, op.assignmentEnd + 220);

            if (!tail.includes(`processFrameworkDownload(${op.downloadVariable})`)) {
                rewrittenCode =
                    `${rewrittenCode.slice(0, op.assignmentEnd)}${callLine}${rewrittenCode.slice(op.assignmentEnd)}`;
                instrumentedDownloads += 1;
            }

            const saveAsRegex = new RegExp(`^\\s*await\\s+${op.downloadVariable}\\.saveAs\\([^\\n]*\\);\\s*$`, "gm");
            rewrittenCode = rewrittenCode.replace(saveAsRegex, "");
        }

        const modifiedCode = rewrittenCode !== originalCode;
        if (modifiedCode) {
            fs.writeFileSync(codeFilePath, rewrittenCode, "utf8");
        }

        return {
            hasDownload: true,
            modifiedCode,
            instrumentedDownloads,
            codeFilePath
        };
    }

    private ensureRuntimeImport(code: string): string {
        const importLine = 'import { processFrameworkDownload } from "./Download/DownloadRuntime";';
        if (code.includes(importLine)) {
            return code;
        }

        const lines = code.split(/\r?\n/);
        const firstNonImport = lines.findIndex((line) => !line.trim().startsWith("import "));

        if (firstNonImport <= 0) {
            return `${importLine}\n${code}`;
        }

        lines.splice(firstNonImport, 0, importLine);
        return lines.join("\n");
    }
}

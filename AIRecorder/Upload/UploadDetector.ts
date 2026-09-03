import path from "node:path";

export interface UploadOperation {
    method: "setInputFiles" | "setFiles";
    argumentText: string;
    sourcePaths: string[];
    startIndex: number;
    endIndex: number;
    lineNumber: number;
}

const uploadRegex = /\b(setInputFiles|setFiles)\(\s*(\[[^\]]*\]|'[^'\r\n]+'|"[^"\r\n]+"|`[^`\r\n]+`)\s*\)/g;
const literalRegex = /['"`]([^'"`]+)['"`]/g;

export function detectUploadOperations(code: string): UploadOperation[] {
    const operations: UploadOperation[] = [];
    let match: RegExpExecArray | null;

    while ((match = uploadRegex.exec(code)) !== null) {
        const method = match[1] as UploadOperation["method"];
        const argumentText = match[2];

        const sourcePaths = Array.from(argumentText.matchAll(literalRegex))
            .map((x) => x[1].trim())
            .filter((x) => x.length > 0);

        if (sourcePaths.length === 0) {
            continue;
        }

        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        const lineNumber = code.slice(0, startIndex).split(/\r?\n/).length;

        operations.push({
            method,
            argumentText,
            sourcePaths,
            startIndex,
            endIndex,
            lineNumber
        });
    }

    return operations;
}

export function isFrameworkRelativeUploadPath(sourcePath: string): boolean {
    const normalized = sourcePath.replace(/\\/g, "/").toLowerCase();
    return normalized.startsWith("uploads/") || normalized.includes("/uploads/") || normalized === "uploads";
}

export function uploadFileName(sourcePath: string): string {
    return path.basename(sourcePath.replace(/\\/g, "/"));
}

import fs from "node:fs";

export interface DownloadValidationResult {
    exists: boolean;
    sizeBytes: number;
    format: string;
    formatValid: boolean;
}

export function validateDownloadedFile(
    downloadPath: string,
    detectedFormat: string,
    expectedFormat?: string
): DownloadValidationResult {
    const exists = fs.existsSync(downloadPath);
    if (!exists) {
        return {
            exists: false,
            sizeBytes: 0,
            format: detectedFormat,
            formatValid: !expectedFormat
        };
    }

    const stat = fs.statSync(downloadPath);
    const formatValid = !expectedFormat || expectedFormat.toUpperCase() === detectedFormat;

    return {
        exists: true,
        sizeBytes: stat.size,
        format: detectedFormat,
        formatValid
    };
}

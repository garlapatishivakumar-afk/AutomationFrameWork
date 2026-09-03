import fs from "node:fs";

export function deleteDownloadedFile(filePath: string | undefined): boolean {
    if (!filePath || !fs.existsSync(filePath)) {
        return false;
    }

    fs.rmSync(filePath, { force: true });
    return true;
}

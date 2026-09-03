import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface UploadResolution {
    resolvedPath: string;
    checkedLocations: string[];
}

export class UploadFileResolver {
    public constructor(private readonly frameworkRoot: string) {}

    public resolve(sourcePathOrName: string): UploadResolution {
        const checkedLocations: string[] = [];
        const candidates = this.buildCandidates(sourcePathOrName);

        for (const candidate of candidates) {
            checkedLocations.push(candidate);
            if (fs.existsSync(candidate)) {
                return { resolvedPath: candidate, checkedLocations };
            }
        }

        throw new Error(
            [
                `Upload file could not be resolved: ${sourcePathOrName}`,
                "Checked locations:",
                ...checkedLocations.map((x) => `- ${x}`)
            ].join("\n")
        );
    }

    private buildCandidates(sourcePathOrName: string): string[] {
        const sourcePath = sourcePathOrName.trim();

        if (path.isAbsolute(sourcePath)) {
            return [path.normalize(sourcePath)];
        }

        const fileName = path.basename(sourcePath);

        return [
            path.join(this.frameworkRoot, sourcePath),
            path.join(this.frameworkRoot, "AIRecorder", sourcePath),
            path.join(this.frameworkRoot, "DataFiles", sourcePath),
            path.join(this.frameworkRoot, "Uploads", fileName),
            path.join(os.homedir(), "Downloads", fileName),
            path.join(os.homedir(), "Desktop", fileName),
            path.join(os.homedir(), "Documents", fileName)
        ].map((x) => path.normalize(x));
    }
}

import fs from "node:fs";
import path from "node:path";
import { buildUploadExpression } from "./UploadPathGenerator";
import { detectUploadOperations, isFrameworkRelativeUploadPath, uploadFileName } from "./UploadDetector";
import { UploadFileResolver } from "./UploadFileResolver";

export interface UploadProcessingResult {
    hasUpload: boolean;
    modifiedCode: boolean;
    createdUploadsFolder: boolean;
    stagedFiles: string[];
    codeFilePath: string;
}

export class UploadAssetManager {
    private readonly uploadsDir: string;
    private readonly resolver: UploadFileResolver;

    public constructor(private readonly frameworkRoot: string = process.cwd()) {
        this.uploadsDir = path.join(this.frameworkRoot, "Uploads");
        this.resolver = new UploadFileResolver(this.frameworkRoot);
    }

    public processCodeFile(relativeCodePath: string = path.join("AIRecorder", "code.ts")): UploadProcessingResult {
        const codeFilePath = path.join(this.frameworkRoot, relativeCodePath);

        if (!fs.existsSync(codeFilePath)) {
            return {
                hasUpload: false,
                modifiedCode: false,
                createdUploadsFolder: false,
                stagedFiles: [],
                codeFilePath
            };
        }

        const originalCode = fs.readFileSync(codeFilePath, "utf8");
        const operations = detectUploadOperations(originalCode);

        if (operations.length === 0) {
            return {
                hasUpload: false,
                modifiedCode: false,
                createdUploadsFolder: false,
                stagedFiles: [],
                codeFilePath
            };
        }

        const uploadSources = operations
            .flatMap((x) => x.sourcePaths)
            .filter((x) => !isFrameworkRelativeUploadPath(x));

        if (uploadSources.length === 0) {
            return {
                hasUpload: true,
                modifiedCode: false,
                createdUploadsFolder: false,
                stagedFiles: [],
                codeFilePath
            };
        }

        const createdUploadsFolder = this.ensureUploadsDir();
        const stagedBySource = new Map<string, string>();

        for (const sourcePath of [...new Set(uploadSources)]) {
            stagedBySource.set(sourcePath, this.stagePath(sourcePath));
        }

        let rewrittenCode = originalCode;
        const reversed = [...operations].reverse();

        for (const op of reversed) {
            const expressions = op.sourcePaths.map((sourcePath) => {
                if (isFrameworkRelativeUploadPath(sourcePath)) {
                    return buildUploadExpression(uploadFileName(sourcePath));
                }

                const stagedPath = stagedBySource.get(sourcePath);
                if (!stagedPath) {
                    throw new Error(`Upload staging map is missing path: ${sourcePath}`);
                }

                return buildUploadExpression(path.basename(stagedPath));
            });

            const argumentExpression = expressions.length === 1
                ? expressions[0]
                : `[${expressions.join(", ")}]`;

            const replacement = `${op.method}(${argumentExpression})`;
            rewrittenCode = `${rewrittenCode.slice(0, op.startIndex)}${replacement}${rewrittenCode.slice(op.endIndex)}`;
        }

        rewrittenCode = this.ensurePathImport(rewrittenCode);

        const modifiedCode = rewrittenCode !== originalCode;
        if (modifiedCode) {
            fs.writeFileSync(codeFilePath, rewrittenCode, "utf8");
        }

        return {
            hasUpload: true,
            modifiedCode,
            createdUploadsFolder,
            stagedFiles: [...new Set([...stagedBySource.values()].map((x) => path.relative(this.frameworkRoot, x).replace(/\\/g, "/")))],
            codeFilePath
        };
    }

    public stagePath(sourcePathOrName: string): string {
        const fileName = uploadFileName(sourcePathOrName);
        this.ensureUploadsDir();

        const resolution = this.resolver.resolve(sourcePathOrName);
        const resolvedPath = resolution.resolvedPath;

        let destinationPath = path.join(this.uploadsDir, fileName);
        if (fs.existsSync(destinationPath)) {
            const sourceBytes = fs.readFileSync(resolvedPath);
            const existingBytes = fs.readFileSync(destinationPath);
            if (Buffer.compare(sourceBytes, existingBytes) === 0) {
                return destinationPath;
            }

            destinationPath = this.nextAvailablePath(fileName);
        }

        if (path.resolve(resolvedPath) !== path.resolve(destinationPath)) {
            fs.copyFileSync(resolvedPath, destinationPath);
        }

        return destinationPath;
    }

    private ensureUploadsDir(): boolean {
        const exists = fs.existsSync(this.uploadsDir);
        if (!exists) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
        return !exists;
    }

    private nextAvailablePath(fileName: string): string {
        const parsed = path.parse(fileName);
        let counter = 2;

        while (true) {
            const next = path.join(this.uploadsDir, `${parsed.name}_${counter}${parsed.ext}`);
            if (!fs.existsSync(next)) {
                return next;
            }
            counter += 1;
        }
    }

    private ensurePathImport(code: string): string {
        if (!code.includes("path.resolve(")) {
            return code;
        }

        const alreadyImported =
            /import\s+path\s+from\s+["']node:path["'];?/.test(code) ||
            /import\s+\*\s+as\s+path\s+from\s+["']path["'];?/.test(code) ||
            /import\s+\*\s+as\s+path\s+from\s+["']node:path["'];?/.test(code);

        if (alreadyImported) {
            return code;
        }

        const lines = code.split(/\r?\n/);
        const importLine = 'import path from "node:path";';
        const firstNonImport = lines.findIndex((line) => !line.trim().startsWith("import "));

        if (firstNonImport <= 0) {
            return `${importLine}\n${code}`;
        }

        lines.splice(firstNonImport, 0, importLine);
        return lines.join("\n");
    }
}

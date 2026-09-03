import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UploadAssetManager } from "./UploadAssetManager";

function makeTempDir(name: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

function write(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
}

function runAll(): void {
    testUploadDetectedAndRewritten();
    testUploadsCreatedWhenMissing();
    testUploadsReusedWhenExists();
    testAbsolutePathRewritten();
    testNoUploadDoesNotCreateFolder();
    testMissingUploadFailsClearly();
    console.log("UploadAssetManager tests: PASS");
}

function testUploadDetectedAndRewritten(): void {
    const root = makeTempDir("upload-detected");
    const source = path.join(root, "DataFiles", "TestFile.txt");
    write(source, "hello upload");
    write(
        path.join(root, "AIRecorder", "code.ts"),
        "await page.locator('input[type=file]').setInputFiles('TestFile.txt');\n"
    );

    const manager = new UploadAssetManager(root);
    const result = manager.processCodeFile("AIRecorder/code.ts");

    assert.equal(result.hasUpload, true);
    assert.equal(fs.existsSync(path.join(root, "Uploads", "TestFile.txt")), true);

    const code = fs.readFileSync(path.join(root, "AIRecorder", "code.ts"), "utf8");
    assert.equal(code.includes('path.resolve(process.cwd(), "Uploads", "TestFile.txt")'), true);
}

function testUploadsCreatedWhenMissing(): void {
    const root = makeTempDir("upload-create");
    write(path.join(root, "DataFiles", "CreateMe.txt"), "create");
    write(
        path.join(root, "AIRecorder", "code.ts"),
        "await chooser.setFiles('CreateMe.txt');\n"
    );

    const manager = new UploadAssetManager(root);
    const result = manager.processCodeFile("AIRecorder/code.ts");

    assert.equal(result.createdUploadsFolder, true);
    assert.equal(fs.existsSync(path.join(root, "Uploads")), true);
}

function testUploadsReusedWhenExists(): void {
    const root = makeTempDir("upload-reuse");
    fs.mkdirSync(path.join(root, "Uploads"), { recursive: true });
    write(path.join(root, "Uploads", "keep.txt"), "keep");
    write(path.join(root, "DataFiles", "reuse.txt"), "reuse");
    write(
        path.join(root, "AIRecorder", "code.ts"),
        "await page.locator('input[type=file]').setInputFiles('reuse.txt');\n"
    );

    const manager = new UploadAssetManager(root);
    const result = manager.processCodeFile("AIRecorder/code.ts");

    assert.equal(result.createdUploadsFolder, false);
    assert.equal(fs.existsSync(path.join(root, "Uploads", "keep.txt")), true);
    assert.equal(fs.existsSync(path.join(root, "Uploads", "reuse.txt")), true);
}

function testAbsolutePathRewritten(): void {
    const root = makeTempDir("upload-absolute");
    const absoluteSource = path.join(root, "Downloads", "AbsoluteFile.txt");
    write(absoluteSource, "absolute");
    write(
        path.join(root, "AIRecorder", "code.ts"),
        `await page.locator('input[type=file]').setInputFiles('${absoluteSource.replace(/\\/g, "\\\\")}');\n`
    );

    const manager = new UploadAssetManager(root);
    manager.processCodeFile("AIRecorder/code.ts");

    const code = fs.readFileSync(path.join(root, "AIRecorder", "code.ts"), "utf8");
    assert.equal(code.includes(absoluteSource), false);
    assert.equal(code.includes('path.resolve(process.cwd(), "Uploads", "AbsoluteFile.txt")'), true);
}

function testNoUploadDoesNotCreateFolder(): void {
    const root = makeTempDir("upload-none");
    write(path.join(root, "AIRecorder", "code.ts"), "await page.goto('https://example.com');\n");

    const manager = new UploadAssetManager(root);
    const result = manager.processCodeFile("AIRecorder/code.ts");

    assert.equal(result.hasUpload, false);
    assert.equal(fs.existsSync(path.join(root, "Uploads")), false);
}

function testMissingUploadFailsClearly(): void {
    const root = makeTempDir("upload-missing");
    write(
        path.join(root, "AIRecorder", "code.ts"),
        "await page.locator('input[type=file]').setInputFiles('NotThere.txt');\n"
    );

    const manager = new UploadAssetManager(root);

    let failed = false;
    try {
        manager.processCodeFile("AIRecorder/code.ts");
    } catch (error) {
        failed = true;
        const message = String((error as Error).message);
        assert.equal(message.includes("Upload file could not be resolved"), true);
        assert.equal(message.includes("Checked locations:"), true);
    }

    assert.equal(failed, true);
}

runAll();

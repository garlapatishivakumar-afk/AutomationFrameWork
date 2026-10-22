const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { generateCSharpCode, inspectRecordingGuards, safeDiagnosticText, collectGenerationIssues, compileGeneratedCSharp } = require("./CSharpCodeGenerator.cjs");
const { rebuildSprint } = require("./SprintMerger.cjs");
const { sprint8Fixture } = require("./CSharpCodeGenerator.Diagnostics.test.cjs");

function runAllTests() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tiered-generation-"));
  try {
    const fixture = sprint8Fixture();
    const recorder = path.join(root, "CodegenAI");
    const batch = path.join(recorder, "Recordings", "Sprint8");
    const work = path.join(batch, ".work", "TC01");
    const tools = path.join(recorder, "AIRecorder", "Generator");
    fs.mkdirSync(work, { recursive: true });
    fs.mkdirSync(tools, { recursive: true });
    const options = { codeFilePath: path.join(work, "Code.ts"), outputFilePath: path.join(work, "Code.cs"),
      reportFilePath: path.join(work, "CSharpGenerationReport.json"), domObservationPath: path.join(work, "LiveObservations.json"),
      projectRoot: root, className: "CodegenFlowTC01", caseId: "TC01", caseTitle: "Create order", enterpriseMode: true };
    fs.writeFileSync(options.codeFilePath, fixture.source);
    fs.writeFileSync(options.domObservationPath, JSON.stringify(fixture.observations));
    fs.writeFileSync(path.join(root, "appsettings.json"), JSON.stringify({ Urls: { Applications: {} } }));
    const strict = generateCSharpCode({ ...options, strictLocators: true });
    assert.strictEqual(strict.codeGenerationBlocked, true);
    const review = generateCSharpCode(options);
    assert.strictEqual(review.codeGenerationBlocked, false);
    assert.strictEqual(review.validation.success, true);
    assert.strictEqual(review.reviewRequired, true);
    assert.deepStrictEqual(review.locatorValidation, strict.locatorValidation, "Policy must not alter any locator rule outcome");
    assert.match(review.code, /\/\/ REVIEW REQUIRED: 4 issue\(s\): line 21 LV012; line 21 LV015; line 8 recordingStart; line 20 suspiciousNavigation\s+public sealed class/);
    assert.deepStrictEqual(review.recordingIssues.map((issue) => [issue.kind, issue.sourceLine]), [["recordingStart", 8], ["suspiciousNavigation", 20]]);
    assert.ok(!JSON.stringify(review.issues).includes("TOKEN"));
    assert.ok(!JSON.stringify(review.issues).includes("?"));
    const body = fixture.source.split(/\r?\n/).slice(7, 23).join("\n");
    assert.deepStrictEqual(inspectRecordingGuards(body).map((issue) => [issue.kind, issue.sourceLine]), [["recordingStart", 1], ["suspiciousNavigation", 13]]);
    for (const segment of ["ErrorPages/ServerError.aspx", "ERROR", "error/nested", "servererror.aspx"]) {
      assert.strictEqual(inspectRecordingGuards(`await page.goto('https://example.test/${segment}?secret=TOKEN');`)[0].kind, "recordingStart");
    }
    for (const source of [
      "await page.goto('https://example.test/default.aspx?error=TOKEN');\nawait page.getByRole('button', {name:'Next'}).click();",
      "await page.goto('https://example.test/start');\nawait page.locator('#add').click();\nawait page.goto('https://other.test/next');",
      "await page.goto('https://example.test/start');\nawait page.locator('#add').click();\nawait page.waitForLoadState();\nawait page.goto('https://example.test/next');"
    ]) assert.deepStrictEqual(inspectRecordingGuards(source), []);
    for (const action of ["click()", "fill('value')", "press('Enter')", "check()"]) {
      assert.strictEqual(inspectRecordingGuards(`await page.goto('https://example.test/start');\nawait page.locator('#add').${action};\n// comment only\nawait page.goto('https://example.test/next');`)[0].kind, "suspiciousNavigation");
    }
    assert.strictEqual(safeDiagnosticText("https://example.test/path?LOB=TOKEN&Product=TOKEN#fragment"), "https://example.test/path");
    assert.ok(!JSON.stringify(collectGenerationIssues({ validation: { errors: ["Timeout at https://example.test/path?token=TOKEN"] } })).includes("TOKEN"));

    const manifestPath = path.join(batch, "manifest.json");
    const manifest = { batchId: "Sprint8", testCases: [{ id: "TC01", title: "Create order", status: "generated", workFolder: ".work/TC01",
      folder: ".", codeTs: "Code.ts", codeCs: "Code.cs", report: "CSharpGenerationReport.json", tableMetadata: "TableLocatorMetadata.json",
      startUrl: "https://example.test/default.aspx?token=TOKEN" }] };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const merged = rebuildSprint(manifestPath);
    assert.strictEqual(merged.report.codeGenerationBlocked, false);
    assert.strictEqual(merged.report.reviewRequired, true);
    assert.strictEqual(merged.report.cases[0].included, true);
    assert.match(merged.codeCs, /REVIEW REQUIRED:[^\n]+\n\s+public sealed class CodegenFlowTC01/);
    assert.strictEqual((merged.codeCs.match(/REVIEW REQUIRED/g) || []).length, 1);
    assert.match(merged.codeTs, /test\('TC01 - Create order'/);
    assert.ok(!merged.codeTs.includes("REVIEW REQUIRED"));
    assert.ok(merged.codeTs.includes("?LOB=TOKEN&Product=TOKEN"), "Recorded navigation must not be rewritten");
    assert.ok(!fs.readFileSync(manifestPath, "utf8").includes("TOKEN"));
    assert.strictEqual(JSON.parse(fs.readFileSync(manifestPath)).testCases[0].reviewRequired, true);

    if (process.platform === "win32") {
      fs.copyFileSync(path.resolve(__dirname, "../../StartCodegen.ps1"), path.join(recorder, "StartCodegen.ps1"));
      const delegate = (file) => `console.error('Fixture native diagnostic: https://example.test/path?token=TOKEN');const r=require('child_process').spawnSync(process.execPath,[${JSON.stringify(path.join(__dirname, file))},...process.argv.slice(2)],{stdio:'inherit'});process.exit(r.status===null?1:r.status);`;
      fs.writeFileSync(path.join(tools, "CSharpCodeGenerator.cjs"), delegate("CSharpCodeGenerator.cjs"));
      fs.writeFileSync(path.join(tools, "SprintMerger.cjs"), delegate("SprintMerger.cjs"));
      const csv = path.join(recorder, "cases.csv");
      fs.writeFileSync(csv, "TestCaseId,Title,StartUrl,Preconditions,ExpectedResult,Priority,DataHint\r\nTC01,Create order,https://example.test/default.aspx?token=TOKEN,Ready,Confirmation,High,\r\n");
      const run = (strictMode, expected) => {
        const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(recorder, "StartCodegen.ps1"),
          "-BatchFile", csv, "-BatchName", "Sprint8", "-GenerateOnly", "-SkipTableLocatorPostProcess", "-NoPrompt", ...(strictMode ? ["-StrictLocators"] : [])], { encoding: "utf8", timeout: 180000 });
        const output = result.stdout + result.stderr;
        assert.strictEqual(result.status, expected, output);
        assert.ok(!output.includes("TOKEN"), output);
        assert.ok(!fs.readFileSync(manifestPath, "utf8").includes("TOKEN"));
        return output;
      };
      const output = run(false, 0);
      assert.match(output, /id\s+REVIEW\s+status/, "REVIEW must be visible in the table, not truncated by terminal width");
      for (const expected of ["REVIEW", "1 case(s) need review", "LV012", "recordingStart", "suspiciousNavigation"]) assert.ok(output.includes(expected), output);
      assert.strictEqual(JSON.parse(fs.readFileSync(manifestPath)).testCases[0].reviewRequired, true);
      assert.match(fs.readFileSync(path.join(batch, "Code.ts"), "utf8"), /TC01 - Create order/);
      run(true, 1);
      assert.strictEqual(fs.readFileSync(path.join(batch, "Code.ts"), "utf8"), "");
      assert.strictEqual(JSON.parse(fs.readFileSync(path.join(batch, "CSharpGenerationReport.json"))).cases[0].included, false);
      run(false, 0);

      // PS 5.1 treats redirected native stderr as an ErrorRecord under Stop.
      // Successful review diagnostics must remain capturable with all streams.
      const captureScript = path.join(root, "Capture.ps1");
      fs.writeFileSync(captureScript, "param([string]$Script,[string]$Csv)\r\n$ErrorActionPreference='Stop'\r\n& $Script -BatchFile $Csv -BatchName Sprint8 -GenerateOnly -SkipTableLocatorPostProcess -NoPrompt *>&1 | Out-Host\r\nexit $LASTEXITCODE\r\n");
      const captured = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", captureScript, "-Script", path.join(recorder, "StartCodegen.ps1"), "-Csv", csv], { encoding: "utf8", timeout: 180000 });
      assert.strictEqual(captured.status, 0, captured.stdout + captured.stderr);
      assert.match(captured.stdout, /1 case\(s\) need review/);

      // Corrupt emitted C# after successful generation. The merger must reject
      // actual code, even if a stale report incorrectly still says success.
      const brokenDelegate = delegate("CSharpCodeGenerator.cjs").replace("process.exit(r.status===null?1:r.status);", `if(r.status===0){const fs=require('fs');const out=process.argv[process.argv.indexOf('--output-file')+1];fs.appendFileSync(out,'\\n}');}process.exit(r.status===null?1:r.status);`);
      fs.writeFileSync(path.join(tools, "CSharpCodeGenerator.cjs"), brokenDelegate);
      const broken = run(false, 1);
      assert.match(broken, /unbalanced braces/);
      assert.strictEqual(JSON.parse(fs.readFileSync(path.join(batch, "CSharpGenerationReport.json"))).cases[0].included, false);
      assert.strictEqual(fs.readFileSync(path.join(batch, "Code.cs"), "utf8"), "");
    }

    fs.writeFileSync(options.codeFilePath, "await page.evaluate(() => 42);");
    const unsupported = generateCSharpCode(options);
    assert.strictEqual(unsupported.validation.success, true);
    assert.strictEqual(unsupported.codeGenerationBlocked, false);
    assert.strictEqual(unsupported.reviewRequired, true);
    assert.strictEqual(unsupported.actionFidelity.success, false, "Fidelity finding is preserved, not weakened");
    assert.ok(unsupported.issues.some((issue) => issue.kind === "unsupportedAction"));
    fs.writeFileSync(options.codeFilePath, "test('broken', async ({page}) => { await page.goto(");
    assert.strictEqual(generateCSharpCode(options).validation.success, false);

    // Real compiler rejection, without referencing or modifying the framework.
    const compilerRoot = path.join(root, "compiler");
    fs.mkdirSync(compilerRoot);
    fs.writeFileSync(path.join(compilerRoot, "Base.csproj"), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>');
    const compiled = compileGeneratedCSharp("public class Broken { public void Run() { undeclared.Call(); } }", { projectRoot: compilerRoot });
    assert.strictEqual(compiled.success, false);
    assert.ok(compiled.errors.some((error) => /CS0103/.test(error)), JSON.stringify(compiled));
    // Simulate a machine without dotnet without changing the parent environment.
    const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") || "PATH";
    const withoutDotnet = spawnSync(process.execPath, ["-e",
      `const {compileGeneratedCSharp}=require(${JSON.stringify(path.join(__dirname, "CSharpCodeGenerator.cjs"))}); console.log(JSON.stringify(compileGeneratedCSharp('public class Draft {}', {projectRoot:${JSON.stringify(compilerRoot)}})));`
    ], { encoding: "utf8", env: { ...process.env, [pathKey]: root } });
    assert.strictEqual(withoutDotnet.status, 0, withoutDotnet.stderr);
    const missingSdk = JSON.parse(withoutDotnet.stdout);
    assert.strictEqual(missingSdk.success, false);
    assert.match(missingSdk.errors[0], /dotnet was not found on PATH/);
    assert.match(missingSdk.errors[0], /case remains structurally blocked/);
    console.log("Tiered tests passed: default included/exit0, StrictLocators excluded/exit1, broken C# excluded/exit1, compiler rejection, guards, redaction, unsupported review");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

if (require.main === module) runAllTests();
module.exports = { runAllTests };
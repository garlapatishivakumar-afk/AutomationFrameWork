const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { startLiveSync } = require("./CSharpLiveSync.cjs");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withTempDir(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "csharp-live-sync-"));
  try {
    await run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeAppSettings(tempDir) {
  fs.writeFileSync(path.join(tempDir, "appsettings.json"), JSON.stringify({
    Urls: {
      DocAdmin: "https://documentadministration-sit.trimont.com/adminReassign.aspx"
    }
  }, null, 2), "utf8");
}

async function waitForFileContains(filePath, text, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      if (content.includes(text)) {
        return content;
      }
    }

    await sleep(50);
  }

  throw new Error(`Timed out waiting for ${path.basename(filePath)} to contain: ${text}`);
}

async function testInitialGeneration() {
  await withTempDir(async (tempDir) => {
    const codeFilePath = path.join(tempDir, "Code.ts");
    const outputFilePath = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFilePath, "await page.goto('https://documentadministration-sit.trimont.com/adminReassign.aspx');", "utf8");

    const liveSync = startLiveSync({
      codeFilePath,
      outputFilePath,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      debounceMs: 25,
      log: false
    });

    try {
      await waitForFileContains(outputFilePath, "await Page.GotoAsync(Config.Urls.DocAdmin);", 3000);
      assert.strictEqual(liveSync.getState().generationCount, 1);
    } finally {
      await liveSync.close();
    }
  });
}

async function testUpdatesOnChange() {
  await withTempDir(async (tempDir) => {
    const codeFilePath = path.join(tempDir, "Code.ts");
    const outputFilePath = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFilePath, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const liveSync = startLiveSync({
      codeFilePath,
      outputFilePath,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      debounceMs: 25,
      log: false
    });

    try {
      await waitForFileContains(outputFilePath, "Name = \"Login\"", 3000);
      fs.writeFileSync(codeFilePath, "await page.getByRole('button', { name: 'Search' }).click();", "utf8");
      const updated = await waitForFileContains(outputFilePath, "Name = \"Search\"", 3000);
      assert.ok(!updated.includes("Name = \"Login\""));
      assert.ok(liveSync.getState().generationCount >= 2);
    } finally {
      await liveSync.close();
    }
  });
}

async function testDebouncesRapidChanges() {
  await withTempDir(async (tempDir) => {
    const codeFilePath = path.join(tempDir, "Code.ts");
    const outputFilePath = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFilePath, "await page.getByText('One').click();", "utf8");

    const liveSync = startLiveSync({
      codeFilePath,
      outputFilePath,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      debounceMs: 100,
      log: false
    });

    try {
      await waitForFileContains(outputFilePath, "Page.GetByText(\"One\")", 3000);
      const initialCount = liveSync.getState().generationCount;
      fs.writeFileSync(codeFilePath, "await page.getByText('Two').click();", "utf8");
      fs.writeFileSync(codeFilePath, "await page.getByText('Three').click();", "utf8");
      fs.writeFileSync(codeFilePath, "await page.getByText('Four').click();", "utf8");
      const finalOutput = await waitForFileContains(outputFilePath, "Page.GetByText(\"Four\")", 3000);
      assert.ok(!finalOutput.includes("Page.GetByText(\"Two\")"));
      assert.ok(!finalOutput.includes("Page.GetByText(\"Three\")"));
      const additionalGenerations = liveSync.getState().generationCount - initialCount;
      assert.ok(additionalGenerations <= 2, `Expected debounced updates, got ${additionalGenerations}`);
    } finally {
      await liveSync.close();
    }
  });
}

async function testStopsOnSignalFile() {
  await withTempDir(async (tempDir) => {
    const codeFilePath = path.join(tempDir, "Code.ts");
    const outputFilePath = path.join(tempDir, "Code.cs");
    const stopSignalFile = path.join(tempDir, ".csharp-live-sync.stop");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFilePath, "await page.getByText('Alive').click();", "utf8");

    const liveSync = startLiveSync({
      codeFilePath,
      outputFilePath,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      stopSignalFile,
      debounceMs: 25,
      log: false
    });

    await waitForFileContains(outputFilePath, "Page.GetByText(\"Alive\")", 3000);
    fs.writeFileSync(stopSignalFile, "stop", "utf8");
    await sleep(250);
    assert.strictEqual(liveSync.getState().closed, true);
  });
}

async function runAllTests() {
  await testInitialGeneration();
  await testUpdatesOnChange();
  await testDebouncesRapidChanges();
  await testStopsOnSignalFile();
  console.log("CSharpLiveSync tests passed");
}

if (require.main === module) {
  runAllTests().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests
};
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runLiveTableLocatorEngine } = require("./LiveTableLocatorEngine.cjs");

function buildDataUrl(html) {
  return `data:text/html,${encodeURIComponent(html)}`;
}

async function testEngineWritesArtifactsAndRewritesTableAction() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "live-table-engine-"));
  const codeFile = path.join(tempDir, "Code.ts");
  const domFile = path.join(tempDir, "LiveObservations.json");
  const metadataFile = path.join(tempDir, "TableLocatorMetadata.json");

  const html = `
    <table id="rgTransactions">
      <tbody>
        <tr id="tx-row-1">
          <td>891411</td>
          <td>Investor</td>
          <td><a href="#">891411</a></td>
        </tr>
      </tbody>
    </table>
  `;

  const code = `
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('${buildDataUrl(html)}');
  await page.getByRole('link', { name: '891411' }).click();
});
`;

  fs.writeFileSync(codeFile, code, "utf8");

  const result = await runLiveTableLocatorEngine({
    codeFilePath: codeFile,
    domFilePath: domFile,
    metadataFilePath: metadataFile,
    storageStateFile: "",
    tableSelector: "table",
    debug: false,
    showBrowser: false,
    skipObservation: false,
    skipRewrite: false
  });

  assert.strictEqual(result.observationExecuted, true);
  assert.strictEqual(result.rewriteExecuted, true);
  assert.ok(result.transformedActions >= 1, "Expected at least one transformed action");
  assert.ok(fs.existsSync(domFile), "Expected DOM observation artifact");
  assert.ok(fs.existsSync(metadataFile), "Expected table metadata artifact");

  const transformedCode = fs.readFileSync(codeFile, "utf8");
  assert.ok(transformedCode.includes("page.locator("), "Expected engine to rewrite Code.ts locator");
}

async function runAllTests() {
  await testEngineWritesArtifactsAndRewritesTableAction();
  console.log("LiveTableLocatorEngine tests passed");
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
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { observeRecordedFlow } = require("./LiveObserver.cjs");
const { transformCode } = require("./TableLocatorIntelligence.cjs");

function buildDataUrl(html) {
  return `data:text/html,${encodeURIComponent(html)}`;
}

async function runE2E() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "table-locator-e2e-"));
  const codeFile = path.join(tempDir, "Code.ts");
  const domFile = path.join(tempDir, "LiveObservations.json");

  const html = `
    <table id="rgTransactions">
      <tbody>
        <tr id="ctl00_ContentPlaceHolder1_rgTransactions_ctl00__5">
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

  const observed = await observeRecordedFlow({
    codeFilePath: codeFile,
    outputFilePath: domFile,
    storageStateFile: "",
    showBrowser: false,
    debug: false
  });

  fs.writeFileSync(domFile, JSON.stringify(observed, null, 2), "utf8");

  const transformed = transformCode({
    codeFilePath: codeFile,
    domFilePath: domFile,
    metadataFilePath: "",
    tableSelector: "table",
    debug: false
  });

  assert.ok(transformed.metadata.analyzedActions >= 1, "Expected at least one analyzed action");
  assert.ok(observed.actions.some((item) => item.insideTable === true), "Observer must detect table ancestry");
  assert.ok(transformed.metadata.transformedActions >= 1, "Expected transformation from observed DOM evidence");
  assert.ok(
    transformed.code.includes("//tr[@id='ctl00_ContentPlaceHolder1_rgTransactions_ctl00__5']//td[3]/a"),
    "Expected row-id locator selected from DOM context"
  );

  console.log("TableLocator E2E test passed");
}

if (require.main === module) {
  runE2E().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runE2E
};

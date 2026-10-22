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

  // A real browser observation of a Telerik empty row must not turn a unique
  // text target into a positional business-row XPath (Sprint16 regression).
  const emptyHtml = '<table id="ctl00_Results_ctl00" class="rgMasterTable"><tbody><tr class="rgNoRecords"><td colspan="3"><div>No records to display.</div></td></tr></tbody></table>';
  const emptyCode = `import { test } from '@playwright/test';
test('empty results', async ({ page }) => {
  await page.goto('${buildDataUrl(emptyHtml)}');
  await page.getByText('No records to display.').click();
});`;
  fs.writeFileSync(codeFile, emptyCode, "utf8");
  const emptyObserved = await observeRecordedFlow({
    codeFilePath: codeFile, outputFilePath: domFile,
    storageStateFile: "", showBrowser: false, debug: false
  });
  const emptyAction = emptyObserved.actions.find((action) => action.line === 4);
  assert.strictEqual(emptyAction.matchCount, 1);
  assert.strictEqual(emptyAction.row.className, "rgNoRecords");
  assert.strictEqual(emptyAction.target.tagName, "div");
  fs.writeFileSync(domFile, JSON.stringify(emptyObserved), "utf8");
  const emptyTransformed = transformCode({
    codeFilePath: codeFile, domFilePath: domFile,
    metadataFilePath: "", tableSelector: "table", debug: false
  });
  assert.strictEqual(emptyTransformed.code, emptyCode);
  assert.strictEqual(emptyTransformed.metadata.actions[0].strategy, "PRESERVE_EMPTY_TABLE_TEXT");
  assert.strictEqual(emptyTransformed.metadata.transformedActions, 0);

  console.log("TableLocator E2E test passed (data rows and empty-results text)");
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

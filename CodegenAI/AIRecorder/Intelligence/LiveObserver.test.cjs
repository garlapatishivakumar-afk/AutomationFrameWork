const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { extractContextForLocator, observeRecordedFlow, parseCodeActions } = require("./LiveObserver.cjs");

async function withPage(fn) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await fn(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function testTableLinkContext() {
  await withPage(async (page) => {
    await page.setContent(`
      <table id="rgTransactions">
        <tbody>
          <tr id="row1">
            <td>891411</td>
            <td>Investor</td>
            <td><a href="#">View</a></td>
          </tr>
        </tbody>
      </table>
    `);

    const locator = page.getByRole("link", { name: "View" });
    const observed = await extractContextForLocator(locator, { text: "View" });

    assert.strictEqual(observed.insideTable, true);
    assert.strictEqual(observed.cell.columnIndex, 3);
    assert.strictEqual(observed.table.id, "rgTransactions");
    assert.strictEqual(observed.row.id, "row1");
  });
}

async function testCellClassCapturedInContext() {
  await withPage(async (page) => {
    await page.setContent(`
      <table id="pkgGrid">
        <tbody>
          <tr id="pkg-row-1">
            <td class="actionIcon viewAttachment">50</td>
          </tr>
        </tbody>
      </table>
    `);

    const locator = page.getByRole("cell", { name: "50" });
    const observed = await extractContextForLocator(locator, { text: "50" });

    assert.strictEqual(observed.cell.className, "actionIcon viewAttachment");
    assert.strictEqual(observed.target.className, "actionIcon viewAttachment");
  });
}

async function testLinkOutsideTable() {
  await withPage(async (page) => {
    await page.setContent(`<div><a href="#">891411</a></div>`);
    const locator = page.getByRole("link", { name: "891411" });
    const observed = await extractContextForLocator(locator, { text: "891411" });
    assert.strictEqual(observed.insideTable, false);
  });
}

async function testMultipleTablesCorrectAssociation() {
  await withPage(async (page) => {
    await page.setContent(`
      <table id="other"><tbody><tr><td><a href="#">View</a></td></tr></tbody></table>
      <table id="targetGrid" data-testid="transactions-grid">
        <tbody>
          <tr id="tx-row-1">
            <td>891411</td>
            <td>Investor</td>
            <td><a href="#">View Tx</a></td>
          </tr>
        </tbody>
      </table>
    `);

    const locator = page.getByRole("link", { name: "View Tx" });
    const observed = await extractContextForLocator(locator, { text: "View Tx" });
    assert.strictEqual(observed.table.id, "targetGrid");
    assert.strictEqual(observed.table.testId, "transactions-grid");
  });
}

async function testDelayedGridRenderAfterSearchReplay() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "live-observer-async-grid-"));
  const codeFile = path.join(tempDir, "Code.ts");
  const htmlFile = path.join(tempDir, "grid.html");

  const html = `
    <button id="search-btn">Search</button>
    <table id="rgTransactions"><tbody id="results-body"></tbody></table>
    <script>
      document.getElementById('search-btn').addEventListener('click', () => {
        setTimeout(() => {
          document.getElementById('results-body').innerHTML =
            '<tr id="tx-row-1"><td>891411</td><td>Investor</td><td><a href="#">891411</a></td></tr>';
        }, 250);
      });
    </script>
  `;

  fs.writeFileSync(htmlFile, html, "utf8");
  const fileUrl = `file:///${htmlFile.replace(/\\/g, "/")}`;
  const code = `
import { test, expect } from '@playwright/test';

test('async-grid', async ({ page }) => {
  await page.goto('${fileUrl}');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('link', { name: '891411' }).click();
});
`;

  fs.writeFileSync(codeFile, code, "utf8");

  const observed = await observeRecordedFlow({
    codeFilePath: codeFile,
    outputFilePath: "",
    storageStateFile: "",
    showBrowser: false,
    debug: false,
    waitTimeoutMs: 8000,
    resolveTimeoutMs: 10000,
    retryIntervalMs: 200
  });

  const targetAction = observed.actions.find((item) => item.text === "891411" && item.role === "link");

  assert.ok(targetAction, "Expected observed target action for delayed grid link");
  assert.ok(targetAction.matchCount > 0, "Expected delayed link locator to resolve after search replay");
  assert.strictEqual(targetAction.insideTable, true, "Expected delayed link to be detected inside table");
  assert.ok(targetAction.cell && targetAction.cell.columnIndex === 3, "Expected delayed link columnIndex=3");
  assert.ok(targetAction.row && targetAction.row.businessValue, "Expected business value to be captured");
}

function testFrameTextActionWithExactIsParsed() {
  const code = `
await page.locator('iframe[name="UpdateTransactionDetails"]').contentFrame().getByText('891224', { exact: true }).click();
await page.locator('iframe[name="UpdateTransactionDetails"]').contentFrame().getByText('310952116').click();
`;

  const actions = parseCodeActions(code);
  assert.strictEqual(actions.length, 2, "Expected both frame text actions to be parsed");
  assert.strictEqual(actions[0].scope, "frame");
  assert.strictEqual(actions[0].text, "891224");
  assert.strictEqual(actions[0].exact, true);
  assert.strictEqual(actions[1].text, "310952116");
}

function testScopedRoleActionIsParsed() {
  const code = `
await page.locator('#ctl00_ContentPlaceHolder1_rgrdException_ctl00__0').getByRole('cell', { name: 'ORA-12537: Network Session:' }).click();
`;

  const actions = parseCodeActions(code);
  assert.strictEqual(actions.length, 1, "Expected scoped role action to be parsed");
  assert.strictEqual(actions[0].kind, "roleAction");
  assert.strictEqual(actions[0].role, "cell");
  assert.strictEqual(actions[0].name, "ORA-12537: Network Session:");
  assert.strictEqual(actions[0].parentSelector, "#ctl00_ContentPlaceHolder1_rgrdException_ctl00__0");
}

function testScopedTextActionIsParsed() {
  const code = `
await page.locator('#ctl00_ContentPlaceHolder1_AttachmentRadGrid_ctl00__0').getByText('Attributed').click();
`;

  const actions = parseCodeActions(code);
  assert.strictEqual(actions.length, 1, "Expected scoped text action to be parsed");
  assert.strictEqual(actions[0].kind, "textAction");
  assert.strictEqual(actions[0].text, "Attributed");
  assert.strictEqual(actions[0].parentSelector, "#ctl00_ContentPlaceHolder1_AttachmentRadGrid_ctl00__0");
}

function testLocatorFirstActionIsParsed() {
  const code = `
await page.locator("//tr[@id='ctl00_ContentPlaceHolder1_PackageRadGrid_ctl00__0']//td[4]").first().click();
`;

  const actions = parseCodeActions(code);
  assert.strictEqual(actions.length, 1, "Expected locator.first action to be parsed");
  assert.strictEqual(actions[0].kind, "locatorAction");
  assert.strictEqual(actions[0].selector, "//tr[@id='ctl00_ContentPlaceHolder1_PackageRadGrid_ctl00__0']//td[4]");
}

async function runAllTests() {
  testFrameTextActionWithExactIsParsed();
  testScopedRoleActionIsParsed();
  testScopedTextActionIsParsed();
  testLocatorFirstActionIsParsed();
  await testTableLinkContext();
  await testCellClassCapturedInContext();
  await testLinkOutsideTable();
  await testMultipleTablesCorrectAssociation();
  await testDelayedGridRenderAfterSearchReplay();
  console.log("LiveObserver tests passed");
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

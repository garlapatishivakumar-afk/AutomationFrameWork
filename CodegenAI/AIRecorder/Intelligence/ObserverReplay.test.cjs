const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { observeRecordedFlow, parseCodeActions } = require("./LiveObserver.cjs");
const { LocatorValidator } = require("./LocatorValidator.cjs");
const { generateCSharpCode, parseRecordedActions } = require("../Generator/CSharpCodeGenerator.cjs");

async function runAllTests() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "observer-replay-"));
  try {
    const htmlFile = path.join(root, "form.html");
    const codeFilePath = path.join(root, "Code.ts");
    const domObservationPath = path.join(root, "observations.json");
    fs.writeFileSync(htmlFile, `
      <textarea id="comments">Type your comments here</textarea>
      <input id="order" aria-label="Order name"><select id="type"><option value="">Select</option><option value="CMBS">CMBS</option></select>
      <button id="next">Next</button><button id="hidden" hidden>Hidden</button><div id="results"></div>
      <script>
        document.querySelector('#order').addEventListener('keydown', e => { if(e.key === 'Tab') document.body.dataset.pressed = 'yes'; });
        document.querySelector('#next').onclick = () => {
          if (document.querySelector('#comments').value === 'test' && document.querySelector('#order').value === 'Order A' && document.querySelector('#type').value === 'CMBS' && document.body.dataset.pressed === 'yes') {
            document.querySelector('#results').innerHTML = '<button id="search">Search</button>';
            document.querySelector('#search').onclick = () => { document.querySelector('#results').innerHTML = '<h2>Confirmation:</h2>'; };
          }
        };
      </script>`);
    const source = [
      `await page.goto(${JSON.stringify(pathToFileURL(htmlFile).href)});`,
      "await page.getByText('Type your comments here').click();",
      "await page.getByText('Type your comments here').fill('test');",
      "await page.getByLabel('Order name').fill('Order A');",
      "await page.getByLabel('Order name').press('Tab');",
      "await page.locator('#type').selectOption({ label: 'CMBS' });",
      "await page.getByRole('button', { name: 'Next', exact: true }).click();",
      "await page.getByRole('button', { name: 'Search', exact: true }).click();",
      "await page.getByRole('heading', { name: 'Confirmation:' }).click();"
    ];
    const observe = async (lines) => {
      fs.writeFileSync(codeFilePath, lines.join("\n"));
      return observeRecordedFlow({ codeFilePath, waitTimeoutMs: 100, resolveTimeoutMs: 500, retryIntervalMs: 50 });
    };
    const observed = await observe(source);
    assert.strictEqual(observed.replayVersion, 2);
    assert.strictEqual(observed.actions.length, source.length);
    assert.ok(observed.actions.every((action) => action.executionStatus === "succeeded"), JSON.stringify(observed.actions.map(a => ({ line: a.line, error: a.error }))));
    assert.strictEqual(observed.actions.at(-1).matchCount, 1, "Input replay must allow Next/Search/Confirmation to resolve");

    const literals = parseCodeActions([
      `await page.getByPlaceholder('Notes').fill(${JSON.stringify("Owner's \\\"notes\\\"")});`,
      "await page.getByTestId('choice').selectOption(['a', 'b']);",
      "await page.getByAltText('Upload').setInputFiles(['one.txt', 'two.txt']);",
      "await page.frameLocator('outer').frameLocator('inner').getByLabel('Value').fill('x');",
      "await page.locator('#input').fill(dynamicValue);"
    ].join("\n"));
    assert.strictEqual(literals.length, 5);
    assert.strictEqual(literals[0].args[0], "Owner's \\\"notes\\\"");
    assert.deepStrictEqual(literals[1].args, [["a", "b"]]);
    assert.deepStrictEqual(literals[2].args, [["one.txt", "two.txt"]]);
    assert.strictEqual(literals[3].chain.length, 3);
    assert.strictEqual(literals[4].kind, "unsupportedAction");

    const unsupported = await observe([source[0], "await page.evaluate(() => {});", source[6]]);
    assert.strictEqual(unsupported.actions[1].executionStatus, "skipped");
    assert.strictEqual(unsupported.actions[2].observationStatus, "unverified");
    assert.strictEqual(unsupported.actions[2].matchCount, undefined);
    const failedClick = await observe([source[0], "await page.locator('#hidden').click();", source[6]]);
    assert.strictEqual(failedClick.actions.length, 3, "Execution failure must not append duplicate zero-count evidence");
    assert.strictEqual(failedClick.actions[1].matchCount, 1);
    assert.strictEqual(failedClick.actions[1].executionStatus, "failed");
    assert.strictEqual(failedClick.actions[2].executionStatus, "skipped");

    // Reproduce old Sprint2 evidence: fills missing, downstream Search count=0.
    const recorded = ["await page.locator('#order').click();", "await page.locator('#order').fill('Order A');", "await page.getByRole('button', { name: 'Search' }).click();"];
    const actions = parseRecordedActions(recorded.join("\n"));
    const legacyEvidence = { actions: [
      { line: 1, raw: recorded[0], matchCount: 1, target: { tagName: "input", id: "order" } },
      { line: 3, raw: recorded[2], matchCount: 0, error: "Timeout waiting for locator to be attached" }
    ] };
    fs.writeFileSync(domObservationPath, JSON.stringify(legacyEvidence));
    let validation = new LocatorValidator({ domObservationPath }).validateActions(actions);
    assert.strictEqual(validation.hasFailures, false);
    assert.strictEqual(validation.observationCoverage.status, "INCOMPLETE");
    assert.strictEqual(validation.observationCoverage.firstUntrustedLine, 2);
    assert.ok(validation.results.find(r => r.sourceLine === 3).rules.some(r => r.ruleId === "LV015" && r.status === "WARNING"));
    fs.writeFileSync(codeFilePath, recorded.join("\n"));
    const generated = generateCSharpCode({ codeFilePath, domObservationPath, projectRoot: root });
    assert.strictEqual(generated.validation.success, true, generated.validation.errors.join(" | "));
    assert.ok(generated.validation.warnings.some(w => w.includes("replay was incomplete")));
    assert.strictEqual(generated.actionFidelity.success, true);

    // Complete replay with a genuine zero/duplicate count still blocks.
    legacyEvidence.actions.splice(1, 0, { line: 2, raw: recorded[1], matchCount: 1, target: { tagName: "input", id: "order" } });
    for (const count of [0, 2]) {
      legacyEvidence.actions[2].matchCount = count;
      fs.writeFileSync(domObservationPath, JSON.stringify(legacyEvidence));
      validation = new LocatorValidator({ domObservationPath }).validateActions(actions);
      assert.strictEqual(validation.hasFailures, true);
      assert.ok(validation.results.at(-1).rules.some(r => r.ruleId === "LV012" && r.status === "FAIL"));
    }
    console.log("Observer replay tests passed (input state, incomplete evidence, strict failures, safe literal parsing)");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
if (require.main === module) runAllTests().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { runAllTests };
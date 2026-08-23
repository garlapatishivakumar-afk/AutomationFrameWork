// V2.1 Enhancement #2/#3/#4 — Unit tests for DOM intelligence components
// Run: npx ts-node AISetup/AIRecorder/Test-DomIntelligence.ts

import { DomClassifier } from "./Intelligence/DomClassifier";
import { LabelResolver } from "./Intelligence/LabelResolver";
import { LocatorNamingEngine } from "./Intelligence/LocatorNamingEngine";
import { LocatorStabilityRanker } from "./Intelligence/LocatorStabilityRanker";
import { TableDetector } from "./Intelligence/TableDetector";

let failed = 0;

function assert(expected: unknown, actual: unknown, label: string): void {
    if (expected === actual) {
        console.log(`  PASS: ${label}`);
    } else {
        console.log(`  FAIL: ${label}  Expected=[${expected}]  Got=[${actual}]`);
        failed++;
    }
}

function assertTruthy(actual: unknown, label: string): void {
    if (actual) {
        console.log(`  PASS: ${label}`);
    } else {
        console.log(`  FAIL: ${label}  Got=[${actual}]`);
        failed++;
    }
}

function assertFalsy(actual: unknown, label: string): void {
    if (!actual) {
        console.log(`  PASS: ${label}`);
    } else {
        console.log(`  FAIL: ${label}  Got=[${actual}]`);
        failed++;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
const classifier = new DomClassifier();
const resolver   = new LabelResolver();
const naming     = new LocatorNamingEngine();
const stability  = new LocatorStabilityRanker();
const table      = new TableDetector();

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- DomClassifier ---");

const r1 = classifier.classify("getByRole('button', { name: 'Search Queue' })", "await page.getByRole('button', { name: 'Search Queue' }).click();");
assert("Button", r1.controlType, "Button from getByRole");
assert("role-attribute", r1.source, "source=role-attribute");

const r2 = classifier.classify("#ctl00_ContentPlaceHolder1_ddlSearchUser", "await page.locator('#ctl00_ContentPlaceHolder1_ddlSearchUser').selectOption('T11542');");
assert("Dropdown", r2.controlType, "Dropdown from ddl prefix");
assert("id-prefix", r2.source, "source=id-prefix");

const r3 = classifier.classify("#ctl00_ContentPlaceHolder1_txtDealNumber", "await page.locator('#ctl00_ContentPlaceHolder1_txtDealNumber').fill('123');");
assert("TextBox", r3.controlType, "TextBox from txt prefix");

const r4 = classifier.classify("getByRole('link', { name: 'Administration' })", "await page.getByRole('link', { name: 'Administration' }).click();");
assert("Link", r4.controlType, "Link from getByRole");

const r5 = classifier.classify("#ctl00_ContentPlaceHolder1_chkActive", "await page.locator('#ctl00_ContentPlaceHolder1_chkActive').check();");
assert("Checkbox", r5.controlType, "Checkbox from chk prefix");

const r6 = classifier.classify("#someUnknownId", "await page.locator('#someUnknownId').click();");
assert("Button", r6.controlType, "Button fallback from click action");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- LabelResolver ---");

const l1 = resolver.resolve("getByRole('button', { name: 'Search Queue' })", "await page.getByRole('button', { name: 'Search Queue' }).click();");
assert("Search Queue", l1.label, "Label from playwright-name");
assert("playwright-name", l1.source, "source=playwright-name");

const l2 = resolver.resolve("#ctl00_ContentPlaceHolder1_ddlSearchUser", "await page.locator('#ctl00_ContentPlaceHolder1_ddlSearchUser').selectOption('T11542');");
assert("Search User", l2.label, "Label derived from ddlSearchUser");
assert("id-derived", l2.source, "source=id-derived");

const l3 = resolver.resolve("getByRole('link', { name: 'Administration' })", "await page.getByRole('link', { name: 'Administration' }).click();");
assert("Administration", l3.label, "Label=Administration from role name");

const l4 = resolver.resolve("#ctl00_ContentPlaceHolder1_txtDealNumber", "await page.locator('#ctl00_ContentPlaceHolder1_txtDealNumber').fill('123');");
assert("Deal Number", l4.label, "Label derived from txtDealNumber");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- LocatorNamingEngine ---");

assert("SearchQueueButton",   naming.derive("Search Queue", "Button", 0.95), "SearchQueueButton");
assert("SearchUserDropdown",  naming.derive("Search User", "Dropdown", 0.85), "SearchUserDropdown");
assert("DealNumberTextbox",   naming.derive("Deal Number", "TextBox", 0.85), "DealNumberTextbox");
assert("AdministrationLink",  naming.derive("Administration", "Link", 0.95), "AdministrationLink");
assert(undefined,             naming.derive("", "Button", 0.9), "Empty label → undefined");
assert(undefined,             naming.derive("Search User", "Dropdown", 0.3), "Low confidence → undefined");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- LocatorStabilityRanker ---");

const s1 = stability.rank("getByRole('button', { name: 'Search Queue' })", "await page.getByRole('button', { name: 'Search Queue' }).click();");
assert("role", s1.preferredStrategy, "Role strategy for getByRole");
assertTruthy(s1.stabilityScore >= 0.85, "High stability for role selector");

const s2 = stability.rank("#ctl00_ContentPlaceHolder1_ddlSearchUser", "await page.locator('#ctl00_ContentPlaceHolder1_ddlSearchUser').selectOption();");
assert("id", s2.preferredStrategy, "ID strategy for CSS ID");
assertTruthy(s2.warnings.length > 0, "Warning for ctl00 generated ID");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- TableDetector ---");

const t1 = table.analyse(
    "#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox",
    "await page.locator('#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox').check();"
);
assertTruthy(t1, "Table analysis returned for rgrid locator");
assert("rgridPackages", t1?.tableId, "Detected rgridPackages as table ID");
assertTruthy(t1?.hasFragileRowIndex, "Fragile row index detected");
assertTruthy(t1?.warnings.length ?? 0 > 0, "Warning produced for fragile row index");

const t2 = table.analyse(
    "getByRole('button', { name: 'Search Queue' })",
    "await page.getByRole('button', { name: 'Search Queue' }).click();"
);
assertFalsy(t2, "Non-table locator returns null");

// ─────────────────────────────────────────────────────────────────────────────
console.log("");
if (failed > 0) {
    console.log(`Result: ${failed} test(s) FAILED`);
    process.exit(1);
} else {
    console.log("Result: All tests PASSED");
}

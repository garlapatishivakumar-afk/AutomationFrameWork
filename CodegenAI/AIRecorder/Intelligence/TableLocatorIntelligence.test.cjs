const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { transformCode } = require("./TableLocatorIntelligence.cjs");

function runTransform(code, observations = {}, tableSelector = "table", extraOptions = {}) {

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "table-locator-test-"));
  const codeFile = path.join(dir, "Code.ts");
  const domFile = path.join(dir, "LiveObservations.json");

  fs.writeFileSync(codeFile, code, "utf8");
  fs.writeFileSync(domFile, JSON.stringify(observations, null, 2), "utf8");

  return transformCode({
    codeFilePath: codeFile,
    domFilePath: domFile,
    metadataFilePath: "",
    tableSelector,
    debug: false,
    ...extraOptions
  });
}

function writeSpecificRulesFile(rulesContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specific-rules-test-"));
  const rulesFile = path.join(dir, "SpecificLocatorRules.json");
  fs.writeFileSync(rulesFile, JSON.stringify(rulesContent, null, 2), "utf8");
  return rulesFile;
}

function testNormalElementUnchanged() {
  const input = "await page.getByRole('button', { name: 'Search' }).click();";
  const result = runTransform(input);
  assert.ok(result.code.includes(input), "Non-table normal element should remain unchanged");
  assert.strictEqual(result.metadata.transformedActions, 0);
}

function testTableLinkRewrittenWithContext() {
  const input = "await page.getByRole('link', { name: '891411' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "891411",
        insideTable: true,
        table: { id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00", className: "rgMasterTable" },
        row: { id: "transactions-row-A1", businessValue: "891411", className: "rgRow", rowValues: ["891411", "Loan", "Open"] },
        cell: { columnIndex: 3 },
        target: { tagName: "a" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(result.code.includes("page.locator("), "Table link should be rewritten to locator");
  assert.ok(
    result.code.includes("await page.locator(") && result.code.includes(".click();"),
    "Rewritten locator should use the inline page.locator(...).action() format"
  );
  assert.strictEqual(result.metadata.transformedActions, 1);
}

function testDuplicateTextUsesObservedRowIdLocator() {
  const input = "await page.getByRole('link', { name: '891411' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "891411",
        insideTable: true,
        duplicateText: true,
        matchCount: 2,
        table: { id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00", className: "rgMasterTable" },
        row: { id: "transactions-row-A1", className: "rgRow" },
        cell: { columnIndex: 3 }
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[@id='transactions-row-A1']//td[3]/a"),
    "Table actions with observed row id should use table-tag locators even when original text is duplicated"
  );
  assert.ok(!result.code.includes("getByRole('link'"), "Rewritten table action should not keep getByRole locator");
  assert.strictEqual(result.metadata.transformedActions, 1);
}

function testDynamicRowPrefersBusinessRow() {
  const input = "await page.getByRole('link', { name: '891411' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "891411",
        insideTable: true,
        table: { id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00", className: "rgMasterTable" },
        row: { id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00__0", businessValue: "891411", className: "rgRow" },
        cell: { columnIndex: 3 },
        target: { tagName: "a" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[@id='ctl00_ContentPlaceHolder1_rgTransactions_ctl00__0']//td[3]/a"),
    "Observed row id should be used when row-id candidate validates strongly"
  );
}

function testRowIdWithCtlAndDoubleUnderscoreChosen() {
  const input = "await page.getByRole('link', { name: '01CMLB1' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "01CMLB1",
        insideTable: true,
        table: { id: "ctl00_cp1_gd_ctl00", className: "rgMasterTable" },
        row: { id: "ctl00_cp1_gd_ctl00__0", businessValue: "20386", className: "rgRow" },
        cell: { columnIndex: 2 },
        target: { tagName: "a" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[@id='ctl00_cp1_gd_ctl00__0']//td[2]/a"),
    "Row IDs with ctl00 and __0 should be accepted as candidates when validation succeeds"
  );
}

function testRowIdDifferentIdAndColumnUsesObservedTag() {
  const input = "await page.getByRole('cell', { name: 'submitted' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "submitted",
        role: "cell",
        insideTable: true,
        table: { id: "gridX", className: "rgMasterTable" },
        row: { id: "tableA_row_14", businessValue: "20390", className: "rgAltRow" },
        cell: { columnIndex: 8 },
        target: { tagName: "span" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[@id='tableA_row_14']//td[8]//span"),
    "Row-id candidate should support different row IDs, columns, and span targets"
  );
}

function testRowIdButtonTarget() {
  const input = "await page.getByRole('button', { name: 'Approve' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "Approve",
        role: "button",
        insideTable: true,
        table: { id: "reviewGrid", className: "k-grid" },
        row: { id: "reviewGrid_row_2", businessValue: "PKG-1002", className: "k-master-row" },
        cell: { columnIndex: 6 },
        target: { tagName: "button" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[@id='reviewGrid_row_2']//td[6]//*[self::button or self::input"),
    "Row-id candidate should support button targets"
  );
}

function testMissingRowIdFallsBackToBusinessValue() {
  const input = "await page.getByRole('link', { name: '01CMLB1' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "01CMLB1",
        insideTable: true,
        table: { id: "dealsGrid", className: "rgMasterTable" },
        row: { id: null, businessValue: "20386", className: "rgRow" },
        cell: { columnIndex: 2 },
        target: { tagName: "a" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[td[text()='20386']]//td[2]/a"),
    "Missing row id should fallback to business-value strategy"
  );
}

function testDuplicateTextStillUsesRowIdLocatorWhenObservedRowIsKnown() {
  const input = "await page.getByRole('link', { name: '01CMLB1' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "01CMLB1",
        insideTable: true,
        duplicateText: true,
        table: { id: "dealsGrid", className: "rgMasterTable" },
        row: { id: "ctl00_cp1_gd_ctl00__0", businessValue: "20386", className: "rgRow" },
        cell: { columnIndex: 2 },
        target: { tagName: "a" },
        matchCount: 2,
        sameBusinessRowCount: 2
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[@id='ctl00_cp1_gd_ctl00__0']//td[2]/a"),
    "Table actions with observed row id should use table-tag locators instead of getByRole/getByText fallback"
  );
  assert.ok(!result.code.includes("getByRole('link'"), "Rewritten table action should not keep getByRole locator");
  assert.strictEqual(result.metadata.transformedActions, 1);
}

function testNoStableRowFallsBackToStructural() {
  const input = "await page.getByRole('link', { name: '891411' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "891411",
        insideTable: true,
        table: { id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00", className: "rgMasterTable" },
        row: { className: "rgRow" },
        cell: { columnIndex: 3 },
        target: { tagName: "a" },
        matchCount: 1
      }
    ]
  };

  const result = runTransform(input, observations, "table");
  assert.ok(
    result.code.includes("//table//tr[td[3]/a]//td[3]/a"),
    "No stable row id should use strongest available non-dynamic structural locator"
  );
}

function testAnalysisFailureFallback() {
  const input = "await page.getByRole('link', { name: '891411' }).click();";
  const result = transformCode({
    codeFilePath: "",
    domFilePath: "",
    metadataFilePath: "",
    tableSelector: "table",
    debug: false
  });

  assert.strictEqual(typeof result.code, "string");
  assert.strictEqual(typeof result.metadata, "object");
  assert.ok(result.metadata.transformedActions >= 0);
  const result2 = runTransform(input, { actions: "invalid" });
  assert.ok(result2.code.includes(input), "Invalid observation shape should not break fallback");
}

function testNumericOutsideTableRemainsOriginal() {
  const input = "await page.getByRole('link', { name: '891411' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "891411",
        insideTable: false,
        matchCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(result.code.includes(input), "Numeric text outside table must stay original");
  assert.strictEqual(result.metadata.transformedActions, 0);
}

function testMultipleTablesUsesCorrectTableScope() {
  const input = "await page.getByRole('link', { name: '891411' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "891411",
        insideTable: true,
        table: { testId: "transactions-grid", id: "transactions-grid", className: "k-grid" },
        row: { businessValue: "891411", className: "k-master-row" },
        cell: { columnIndex: 3 },
        target: { tagName: "a" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("@data-testid='transactions-grid'") ||
      result.code.includes("//tr[td[text()='891411']]//td[3]/a") ||
      result.code.includes("//table[@id='transactions-grid']"),
    "Should use validated table-aware scoped locator when context is available"
  );
}

function testTableCellActionRewrittenAsCellTarget() {
  const input = "await page.getByRole('cell', { name: '891411' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "891411",
        role: "cell",
        insideTable: true,
        table: { id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00", className: "rgMasterTable rgClipCells" },
        row: {
          id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00__0",
          businessValue: "891411",
          className: "rgRow",
          rowValues: ["891411", "1852897", "CX (4)"]
        },
        cell: { columnIndex: 3 },
        target: { tagName: "td" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[@id='ctl00_ContentPlaceHolder1_rgTransactions_ctl00__0']//td[3]"),
    "Cell actions should use row-id and target cell text without column index"
  );
  assert.strictEqual(result.metadata.transformedActions, 1);
}

function testTransientControlTableFallsBack() {
  const input = "await page.getByRole('link', { name: 'Close' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "Close",
        role: "link",
        insideTable: true,
        table: { id: null, className: "rwTitlebarControls" },
        row: {
          id: null,
          businessValue: "Add/Edit Transaction Details",
          className: null,
          rowValues: ["Add/Edit Transaction Details", "Close"]
        },
        cell: { columnIndex: 3 },
        target: { tagName: "a" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(result.code.includes(input), "Transient non-grid control tables should fallback to original locator");
  assert.strictEqual(result.metadata.transformedActions, 0);
}

function testFrameKeyValueTextActionRewritten() {
  const input = "await page.locator('iframe[name=\"UpdateTransactionDetails\"]').contentFrame().getByText('310952116').click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "310952116",
        insideTable: true,
        scope: "frame",
        frameSelector: 'iframe[name="UpdateTransactionDetails"]',
        table: { id: null, className: null },
        row: {
          id: "trTransaction",
          labelValue: "Loan Number:",
          businessValue: "Loan Number:",
          className: null,
          rowValues: ["Loan Number:", "310952116"]
        },
        cell: { columnIndex: 2 },
        target: { tagName: "span", id: "lblLoanInfoLNo" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("contentFrame().locator(\"//span[@id='lblLoanInfoLNo']\")"),
    "Frame key/value text actions should prefer stable target id over inner-text locator"
  );
  assert.strictEqual(result.metadata.transformedActions, 1);
}

function testDynamicTableIdRejectedAndRowIdUsed() {
  const input = "await page.getByRole('link', { name: '891224' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "891224",
        insideTable: true,
        table: { id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00", className: "rgMasterTable rgClipCells" },
        row: {
          id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00__6",
          businessValue: "310952116",
          className: "rgRow",
          rowValues: ["891224", "310952116", "NONE (0)"]
        },
        cell: { columnIndex: 3 },
        target: { tagName: "a" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[@id='ctl00_ContentPlaceHolder1_rgTransactions_ctl00__6']//td[3]/a"),
    "Dynamic table ids should be avoided while allowing row-id candidate from live evidence"
  );
  assert.ok(
    !result.code.includes("//table[@id='ctl00_ContentPlaceHolder1_rgTransactions_ctl00']"),
    "Dynamic table id should not be used as table-scope selector"
  );
}

function testStableNumericBusinessValueAccepted() {
  const input = "await page.getByRole('link', { name: '891224' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "891224",
        insideTable: true,
        table: { id: "transactionsGrid", className: "k-grid" },
        row: {
          id: null,
          businessValue: "310952116",
          className: "k-master-row",
          rowValues: ["891224", "310952116", "Open"]
        },
        cell: { columnIndex: 3 },
        target: { tagName: "a" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[td[text()='310952116']]//td[3]/a"),
    "Stable numeric business identifiers should be accepted as row anchors"
  );
}

function testScopedRoleActionRewrittenWithRowIdCandidate() {
  const input = "await page.locator('#ctl00_ContentPlaceHolder1_rgrdException_ctl00__0').getByRole('cell', { name: 'ORA-12537: Network Session:' }).click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "ORA-12537: Network Session:",
        role: "cell",
        insideTable: true,
        table: { id: "ctl00_ContentPlaceHolder1_rgrdException_ctl00", className: "rgMasterTable rgClipCells" },
        row: {
          id: "ctl00_ContentPlaceHolder1_rgrdException_ctl00__0",
          businessValue: "ORA-12537: Network Session:",
          className: "rgRow"
        },
        cell: { columnIndex: 1 },
        target: { tagName: "td" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("//tr[@id='ctl00_ContentPlaceHolder1_rgrdException_ctl00__0']//td[1]"),
    "Scoped role actions should rewrite using row-id candidate when validated"
  );
  assert.strictEqual(result.metadata.transformedActions, 1);
}

function testSpecificNonTableTextRuleRewritesToUniqueAttribute() {
  const input = "await page.getByText('Garlapati, Shivakumar').click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "Garlapati, Shivakumar",
        insideTable: false,
        target: {
          tagName: "span",
          testId: "user-display-name",
          id: null,
          ariaLabel: "Signed in user",
          attributeCounts: {
            testId: 1,
            id: 0,
            ariaLabel: 2
          }
        },
        matchCount: 1
      }
    ]
  };

  const specificRulesFilePath = writeSpecificRulesFile({
    enabled: true,
    rules: [
      {
        id: "username-display",
        enabled: true,
        match: {
          onlyNonTable: true,
          kinds: ["text"],
          originalLocatorContains: "page.getByText('Garlapati, Shivakumar')"
        },
        allowedAttributes: ["data-testid", "id", "aria-label"]
      }
    ]
  });

  const result = runTransform(input, observations, "table", { specificRulesFilePath });
  assert.ok(
    result.code.includes("await page.locator(\"//span[@data-testid='user-display-name']\").click();"),
    "Specific non-table rule should rewrite to unique tag+data-testid locator"
  );
  assert.strictEqual(result.metadata.transformedActions, 1);
}

function testSpecificNonTableRuleSkipsWhenAttributeNotUnique() {
  const input = "await page.getByText('Garlapati, Shivakumar').click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "Garlapati, Shivakumar",
        insideTable: false,
        target: {
          tagName: "span",
          testId: "user-display-name",
          id: "userName",
          ariaLabel: "Signed in user",
          attributeCounts: {
            testId: 2,
            id: 2,
            ariaLabel: 3
          }
        },
        matchCount: 1
      }
    ]
  };

  const specificRulesFilePath = writeSpecificRulesFile({
    enabled: true,
    rules: [
      {
        id: "username-display",
        enabled: true,
        match: {
          onlyNonTable: true,
          kinds: ["text"],
          originalLocatorContains: "page.getByText('Garlapati, Shivakumar')"
        },
        allowedAttributes: ["data-testid", "id", "aria-label"]
      }
    ]
  });

  const result = runTransform(input, observations, "table", { specificRulesFilePath });
  assert.ok(result.code.includes(input), "Should keep original locator when no unique allowed attribute exists");
  assert.strictEqual(result.metadata.transformedActions, 0);
}

function testScopedTextActionRewrittenWithRowIdCandidate() {
  const input = "await page.locator('#ctl00_ContentPlaceHolder1_AttachmentRadGrid_ctl00__0').getByText('Attributed').click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "Attributed",
        insideTable: true,
        table: { id: "ctl00_ContentPlaceHolder1_AttachmentRadGrid_ctl00", className: "rgMasterTable rgClipCells" },
        row: {
          id: "ctl00_ContentPlaceHolder1_AttachmentRadGrid_ctl00__0",
          businessValue: "Loan-1001",
          className: "rgRow",
          rowValues: ["Loan-1001", "Attributed", "Open"]
        },
        cell: { columnIndex: 5 },
        target: { tagName: "span" },
        matchCount: 2,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("await page.locator(\"//tr[@id='ctl00_ContentPlaceHolder1_AttachmentRadGrid_ctl00__0']//td[5]//span\").click();"),
    "Scoped getByText table action should rewrite to table-tag locator using observed row id and column"
  );
  assert.ok(!result.code.includes("getByText('Attributed')"), "Table rewritten action should not keep getByText locator");
  assert.strictEqual(result.metadata.transformedActions, 1);
}

function testExistingIndexedTableLocatorKeepsIndexWhenNoUniqueAttribute() {
  const input = "await page.locator(\"//tr[@id='ctl00_ContentPlaceHolder1_AttachmentRadGrid_ctl00__0']/td[5]\").first().click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "Attributed",
        insideTable: true,
        table: { id: "ctl00_ContentPlaceHolder1_AttachmentRadGrid_ctl00", className: "rgMasterTable rgClipCells" },
        row: {
          id: "ctl00_ContentPlaceHolder1_AttachmentRadGrid_ctl00__0",
          businessValue: "300802598",
          className: "rgRow",
          rowValues: ["300802598", "Attributed", "Open"]
        },
        cell: { columnIndex: 5 },
        target: { tagName: "td" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("await page.locator(\"//tr[@id='ctl00_ContentPlaceHolder1_AttachmentRadGrid_ctl00__0']//td[5]\").click();"),
    "Existing index-based table locator should use index fallback when no unique attribute exists"
  );
  assert.ok(result.code.includes("//td[5]"), "Column index fallback should be allowed when attributes are unavailable");
  assert.strictEqual(result.metadata.transformedActions, 1);
}

function testRowIdPrefersStableCellClassOverIndex() {
  const input = "await page.locator(\"//tr[@id='ctl00_ContentPlaceHolder1_PackageRadGrid_ctl00__0']/td[4]\").first().click();";
  const observations = {
    actions: [
      {
        line: 1,
        text: "50",
        insideTable: true,
        table: { id: "ctl00_ContentPlaceHolder1_PackageRadGrid_ctl00", className: "rgMasterTable rgClipCells" },
        row: {
          id: "ctl00_ContentPlaceHolder1_PackageRadGrid_ctl00__0",
          businessValue: "Duplicate attachments - Q1 2026 Compliance - WF/Tr...",
          className: "rgRow",
          rowValues: ["Duplicate attachments - Q1 2026 Compliance - WF/Tr...", "50"]
        },
        cell: { columnIndex: 4, className: "actionIcon viewAttachment" },
        target: { tagName: "td", className: "actionIcon viewAttachment" },
        matchCount: 1,
        sameBusinessRowCount: 1
      }
    ]
  };

  const result = runTransform(input, observations);
  assert.ok(
    result.code.includes("await page.locator(\"//tr[@id='ctl00_ContentPlaceHolder1_PackageRadGrid_ctl00__0']//td[@class='actionIcon viewAttachment']\").click();"),
    "Stable td class should be preferred over td index inside observed row"
  );
  assert.strictEqual(result.metadata.transformedActions, 1);
}

function runAllTests() {
  testNormalElementUnchanged();
  testTableLinkRewrittenWithContext();
  testDuplicateTextUsesObservedRowIdLocator();
  testDynamicRowPrefersBusinessRow();
  testRowIdWithCtlAndDoubleUnderscoreChosen();
  testRowIdDifferentIdAndColumnUsesObservedTag();
  testRowIdButtonTarget();
  testMissingRowIdFallsBackToBusinessValue();
  testDuplicateTextStillUsesRowIdLocatorWhenObservedRowIsKnown();
  testNoStableRowFallsBackToStructural();
  testAnalysisFailureFallback();
  testNumericOutsideTableRemainsOriginal();
  testMultipleTablesUsesCorrectTableScope();
  testTableCellActionRewrittenAsCellTarget();
  testTransientControlTableFallsBack();
  testFrameKeyValueTextActionRewritten();
  testDynamicTableIdRejectedAndRowIdUsed();
  testStableNumericBusinessValueAccepted();
  testScopedRoleActionRewrittenWithRowIdCandidate();
  testScopedTextActionRewrittenWithRowIdCandidate();
  testExistingIndexedTableLocatorKeepsIndexWhenNoUniqueAttribute();
  testRowIdPrefersStableCellClassOverIndex();
  testSpecificNonTableTextRuleRewritesToUniqueAttribute();
  testSpecificNonTableRuleSkipsWhenAttributeNotUnique();
  console.log("TableLocatorIntelligence tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};

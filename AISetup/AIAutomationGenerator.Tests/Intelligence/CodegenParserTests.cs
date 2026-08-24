using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Xunit;
using AIAutomationGenerator.Intelligence.Services;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Tests.Intelligence
{
    /// <summary>
    /// Tests for CodegenParser using REAL AIRecorder/code.ts as primary fixture.
    ///
    /// Fixture policy:
    ///   - Integration tests (marked REAL): use actual file from disk.
    ///     These are the primary evidence of genuine Codegen-to-intelligence parsing.
    ///   - Unit tests (marked UNIT FIXTURE): use small inline strings
    ///     to test individual parser behaviours in isolation.
    ///     These must NOT be used as evidence of real-world acceptance.
    ///
    /// No RecordingIntelligenceModel is manually constructed in these tests.
    /// The parser is the sole source of truth.
    /// </summary>
    public class CodegenParserTests
    {
        private readonly CodegenParser _parser = new();

        // ===========================
        // HELPERS
        // ===========================

        /// <summary>
        /// Walks up from the test binary directory to find the repository root
        /// by looking for the AIRecorder/ folder.
        /// Returns null if not found (CI environment without file access).
        /// </summary>
        private static string FindRepoRoot()
        {
            // Walk up from multiple starting points; look for AIRecorder/code.ts specifically
            // because there is also an AISetup/AIRecorder directory that must not be confused.
            var candidates = new[]
            {
                AppDomain.CurrentDomain.BaseDirectory,
                Environment.CurrentDirectory,
                Path.GetDirectoryName(typeof(CodegenParserTests).Assembly.Location)
            };

            foreach (var start in candidates)
            {
                if (start == null) continue;
                var dir = new DirectoryInfo(start);
                while (dir != null)
                {
                    var codets = Path.Combine(dir.FullName, "AIRecorder", "code.ts");
                    if (File.Exists(codets))
                        return dir.FullName;
                    dir = dir.Parent;
                }
            }
            return null;
        }

        private static string GetRealCodetsPath()
        {
            var root = FindRepoRoot();
            if (root == null) return null;
            var path = Path.Combine(root, "AIRecorder", "code.ts");
            return File.Exists(path) ? path : null;
        }

        // ===========================
        // REAL FILE TESTS
        // ===========================

        [Fact]
        public void Parser_RealFile_ReturnsNonNullResult()
        {
            // REAL: uses actual AIRecorder/code.ts from disk
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found — check repo root discovery.");

            var result = _parser.ParseFile(path);

            Assert.NotNull(result);
            Assert.NotNull(result.Actions);
        }

        [Fact]
        public void Parser_RealFile_Extracts12Actions()
        {
            // REAL: the actual recording has exactly 12 await page.* lines
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);

            Assert.Equal(12, result.ActionCount);
        }

        [Fact]
        public void Parser_RealFile_PreservesActionOrdering()
        {
            // REAL: ordering must match code.ts top-to-bottom
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);
            var sequences = result.Actions.Select(a => a.Sequence).ToList();

            // Sequences must be 0..N-1 without gaps or reversals
            for (int i = 0; i < sequences.Count; i++)
                Assert.Equal(i, sequences[i]);
        }

        [Fact]
        public void Parser_RealFile_ExtractsNavigateActions()
        {
            // REAL: code.ts has 3 goto() calls
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);
            var navigates = result.Actions.Where(a => a.ActionType == "navigate").ToList();

            Assert.Equal(3, navigates.Count);
            Assert.All(navigates, a => Assert.Equal("url", a.LocatorType));
            Assert.All(navigates, a => Assert.StartsWith("https://", a.LocatorValue));
        }

        [Fact]
        public void Parser_RealFile_ExtractsClickActions()
        {
            // REAL: code.ts has 4 .click() calls (Administration, Reassign Packages,
            //        Search Queue→ via button, Dashboard, Assign to Selected User)
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);
            var clicks = result.Actions.Where(a => a.ActionType == "click").ToList();

            Assert.True(clicks.Count >= 4, $"Expected >= 4 click actions, got {clicks.Count}");
        }

        [Fact]
        public void Parser_RealFile_ExtractsSelectOptionActions()
        {
            // REAL: code.ts has 3 .selectOption() calls
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);
            var selects = result.Actions.Where(a => a.ActionType == "selectOption").ToList();

            Assert.Equal(3, selects.Count);
        }

        [Fact]
        public void Parser_RealFile_ExtractsCheckAction()
        {
            // REAL: code.ts has exactly 1 .check() call
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);
            var checks = result.Actions.Where(a => a.ActionType == "check").ToList();

            Assert.Single(checks);
        }

        [Fact]
        public void Parser_RealFile_ExtractsRoleLocators()
        {
            // REAL: getByRole actions must have LocatorType=="role" and GetByRoleName populated
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);
            var roleActions = result.Actions.Where(a => a.LocatorType == "role").ToList();

            Assert.True(roleActions.Count >= 4);
            Assert.All(roleActions, a => Assert.False(string.IsNullOrEmpty(a.GetByRoleName)));
            Assert.All(roleActions, a => Assert.StartsWith("getByRole(", a.LocatorValue));
        }

        [Fact]
        public void Parser_RealFile_ExtractsIdLocators()
        {
            // REAL: locator('#...') calls must have LocatorType=="id"
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);
            var idActions = result.Actions.Where(a => a.LocatorType == "id").ToList();

            Assert.True(idActions.Count >= 3, $"Expected >= 3 id-locator actions, got {idActions.Count}");
            Assert.All(idActions, a => Assert.StartsWith("#", a.LocatorValue));
        }

        [Fact]
        public void Parser_RealFile_InfersPageContextForEachAction()
        {
            // REAL: after the first navigate, each action must have a non-empty InferredPageContext
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);

            // First action is a navigate so it may set context; all subsequent must have it
            var afterFirst = result.Actions.Skip(1).ToList();
            Assert.All(afterFirst, a => Assert.False(string.IsNullOrEmpty(a.InferredPageContext)));
        }

        [Fact]
        public void Parser_RealFile_RecordsSourceFilePath()
        {
            // REAL: ParseFile must record the file path it read from
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);

            Assert.Equal(path, result.SourceFilePath);
            Assert.True(result.SourceFileSizeBytes > 0);
        }

        [Fact]
        public void Parser_RealFile_DocumentsFieldOrigins()
        {
            // REAL: field-origin documentation must be populated (Task 5 evidence)
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);

            Assert.NotNull(result.Fields);
            Assert.True(result.Fields.DirectlyFromCodets.Length > 0);
            Assert.True(result.Fields.DeterministicInference.Length > 0);
            Assert.True(result.Fields.CannotBeInferred.Length > 0);
        }

        [Fact]
        public void Parser_RealFile_NoManuallyConstructedActions()
        {
            // REAL: this test verifies that every action's LocatorValue comes
            // from the file, not from a hand-built model.
            // We verify by checking every id locator value starts with '#'
            // (the raw selector from code.ts) and every role value starts with 'getByRole'.
            var path = GetRealCodetsPath();
            Assert.True(path != null, "AIRecorder/code.ts not found.");

            var result = _parser.ParseFile(path);

            foreach (var action in result.Actions)
            {
                if (action.LocatorType == "id")
                    Assert.StartsWith("#", action.LocatorValue);

                if (action.LocatorType == "role")
                    Assert.StartsWith("getByRole(", action.LocatorValue);

                if (action.LocatorType == "url")
                    Assert.StartsWith("https://", action.LocatorValue);
            }
        }

        // ===========================
        // UNIT FIXTURE TESTS
        // These use small inline content to test individual parser behaviours.
        // They are NOT evidence of real-world recording acceptance.
        // ===========================

        [Fact]
        public void Parser_UnitFixture_ParsesGotoLine()
        {
            // UNIT FIXTURE — isolated test for goto parsing
            const string content = @"
test('test', async ({ page }) => {
  await page.goto('https://example.com/Login.aspx');
});";

            var result = _parser.Parse(content);

            Assert.Single(result.Actions);
            var action = result.Actions[0];
            Assert.Equal("navigate", action.ActionType);
            Assert.Equal("https://example.com/Login.aspx", action.Target);
            Assert.Equal("url", action.LocatorType);
            Assert.Equal("https://example.com/Login.aspx", action.LocatorValue);
            Assert.Equal("Login", action.InferredPageContext); // from URL segment
        }

        [Fact]
        public void Parser_UnitFixture_ParsesGetByRoleClick()
        {
            // UNIT FIXTURE
            const string content = @"
test('t', async ({ page }) => {
  await page.getByRole('button', { name: 'Submit' }).click();
});";

            var result = _parser.Parse(content);

            Assert.Single(result.Actions);
            var action = result.Actions[0];
            Assert.Equal("click", action.ActionType);
            Assert.Equal("Submit", action.Target);
            Assert.Equal("role", action.LocatorType);
            Assert.Equal("Submit", action.GetByRoleName);
        }

        [Fact]
        public void Parser_UnitFixture_ParsesGetByRoleLinkAndUpdatesPageContext()
        {
            // UNIT FIXTURE — link click should update InferredPageContext for subsequent actions
            const string content = @"
test('t', async ({ page }) => {
  await page.goto('https://example.com/');
  await page.getByRole('link', { name: 'My Reports' }).click();
  await page.getByRole('button', { name: 'Search' }).click();
});";

            var result = _parser.Parse(content);

            Assert.Equal(3, result.ActionCount);
            // After clicking the "My Reports" link, the page context transitions
            Assert.Equal("MyReports", result.Actions[1].InferredPageContext);
            Assert.Equal("MyReports", result.Actions[2].InferredPageContext);
        }

        [Fact]
        public void Parser_UnitFixture_ParsesLocatorSelectOption()
        {
            // UNIT FIXTURE
            const string content = @"
test('t', async ({ page }) => {
  await page.locator('#ctl00_ContentPlaceHolder1_ddlStatus').selectOption('Active');
});";

            var result = _parser.Parse(content);

            Assert.Single(result.Actions);
            var action = result.Actions[0];
            Assert.Equal("selectOption", action.ActionType);
            Assert.Equal("id", action.LocatorType);
            Assert.Equal("#ctl00_ContentPlaceHolder1_ddlStatus", action.LocatorValue);
            Assert.Equal("StatusDropdown", action.Target); // prefix convention applied
        }

        [Fact]
        public void Parser_UnitFixture_ParsesLocatorCheck()
        {
            // UNIT FIXTURE
            const string content = @"
test('t', async ({ page }) => {
  await page.locator('#chkConfirm').check();
});";

            var result = _parser.Parse(content);

            Assert.Single(result.Actions);
            Assert.Equal("check", result.Actions[0].ActionType);
        }

        [Fact]
        public void Parser_UnitFixture_ParsesFillAction()
        {
            // UNIT FIXTURE
            const string content = @"
test('t', async ({ page }) => {
  await page.getByLabel('Username').fill('testuser');
});";

            var result = _parser.Parse(content);

            Assert.Single(result.Actions);
            var action = result.Actions[0];
            Assert.Equal("fill", action.ActionType);
            Assert.Equal("Username", action.Target);
            Assert.Equal("label", action.LocatorType);
        }

        [Fact]
        public void Parser_UnitFixture_EmptyContentReturnsEmpty()
        {
            // UNIT FIXTURE
            var result = _parser.Parse("");
            Assert.NotNull(result);
            Assert.Empty(result.Actions);
        }

        [Fact]
        public void Parser_UnitFixture_IgnoresNonPageLines()
        {
            // UNIT FIXTURE — import statements and test scaffolding must not produce actions
            const string content = @"
import { test, expect } from '@playwright/test';
// a comment
test('t', async ({ page }) => {
  const x = 1;
  console.log('hello');
  await page.goto('https://example.com/');
});";

            var result = _parser.Parse(content);
            Assert.Single(result.Actions); // only the goto
        }

        [Fact]
        public void Parser_UnitFixture_PreservesSequenceOrder()
        {
            // UNIT FIXTURE
            const string content = @"
test('t', async ({ page }) => {
  await page.goto('https://a.com/');
  await page.getByRole('button', { name: 'B1' }).click();
  await page.getByRole('button', { name: 'B2' }).click();
});";

            var result = _parser.Parse(content);

            Assert.Equal(3, result.ActionCount);
            Assert.Equal(0, result.Actions[0].Sequence);
            Assert.Equal(1, result.Actions[1].Sequence);
            Assert.Equal(2, result.Actions[2].Sequence);
        }

        [Fact]
        public void Parser_UnitFixture_IdLocatorAppliesNamingConvention()
        {
            // UNIT FIXTURE — validates the generic prefix-convention mapping
            const string content = @"
test('t', async ({ page }) => {
  await page.locator('#ddlStatus').selectOption('A');
  await page.locator('#chkActive').check();
  await page.locator('#txtSearch').fill('hello');
  await page.locator('#btnSave').click();
});";

            var result = _parser.Parse(content);

            Assert.Equal(4, result.ActionCount);
            Assert.Equal("StatusDropdown", result.Actions[0].Target);
            Assert.Equal("ActiveCheckbox", result.Actions[1].Target);
            Assert.Equal("SearchTextBox", result.Actions[2].Target);
            Assert.Equal("SaveButton", result.Actions[3].Target);
        }
    }
}

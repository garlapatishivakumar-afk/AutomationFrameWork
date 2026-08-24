using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Intelligence.Services
{
    /// <summary>
    /// Parses a Playwright Codegen TypeScript recording into RecordedActionIntelligence list.
    ///
    /// This is the genuine entry point for the V4.0 pipeline:
    ///   code.ts → CodegenParser → List&lt;RecordedActionIntelligence&gt;
    ///           → AutomationIntelligenceEngine → AutomationIntelligenceModel
    ///           → P2 Generation → P3 Validation
    ///
    /// Design constraints:
    /// - No hardcoding of application-specific names, URLs, or workflows.
    /// - All extraction is deterministic regex against Playwright Codegen syntax.
    /// - Fields that cannot be reliably inferred are left null/empty (not guessed).
    /// - Page context is inferred from URL paths and link-click sequences.
    /// </summary>
    public class CodegenParser
    {
        // ===== Playwright Codegen line patterns =====

        // await page.goto('https://...')
        private static readonly Regex GotoPattern =
            new(@"await\s+page\.goto\('([^']+)'\)", RegexOptions.Compiled);

        // await page.getByRole('role', { name: 'Label' })
        private static readonly Regex GetByRolePattern =
            new(@"await\s+page\.getByRole\('(\w+)',\s*\{\s*name:\s*'([^']+)'\s*\}\)", RegexOptions.Compiled);

        // await page.locator('selector')
        private static readonly Regex LocatorPattern =
            new(@"await\s+page\.locator\('([^']+)'\)", RegexOptions.Compiled);

        // await page.getByLabel('label')
        private static readonly Regex GetByLabelPattern =
            new(@"await\s+page\.getByLabel\('([^']+)'\)", RegexOptions.Compiled);

        // await page.getByPlaceholder('placeholder')
        private static readonly Regex GetByPlaceholderPattern =
            new(@"await\s+page\.getByPlaceholder\('([^']+)'\)", RegexOptions.Compiled);

        // await page.getByText('text')
        private static readonly Regex GetByTextPattern =
            new(@"await\s+page\.getByText\('([^']+)'\)", RegexOptions.Compiled);

        // Action suffixes chained onto the locator
        private static readonly Regex ClickSuffix       = new(@"\.click\(\)\s*;", RegexOptions.Compiled);
        private static readonly Regex SelectSuffix      = new(@"\.selectOption\('([^']*)'\)\s*;", RegexOptions.Compiled);
        private static readonly Regex CheckSuffix       = new(@"\.check\(\)\s*;", RegexOptions.Compiled);
        private static readonly Regex UncheckSuffix     = new(@"\.uncheck\(\)\s*;", RegexOptions.Compiled);
        private static readonly Regex FillSuffix        = new(@"\.fill\('([^']*)'\)\s*;", RegexOptions.Compiled);
        private static readonly Regex TypeSuffix        = new(@"\.type\('([^']*)'\)\s*;", RegexOptions.Compiled);
        private static readonly Regex PressKeySuffix    = new(@"\.press\('([^']*)'\)\s*;", RegexOptions.Compiled);
        private static readonly Regex HoverSuffix       = new(@"\.hover\(\)\s*;", RegexOptions.Compiled);

        private static readonly Regex TestNamePattern   =
            new(@"test\('([^']+)'", RegexOptions.Compiled);

        // ===== Public API =====

        /// <summary>
        /// Read code.ts from disk and parse it.
        /// The file path is the single source of truth for recording data.
        /// </summary>
        public CodegenParseResult ParseFile(string filePath)
        {
            if (!File.Exists(filePath))
                throw new FileNotFoundException($"Codegen recording not found: {filePath}");

            var content = File.ReadAllText(filePath);
            var result = Parse(content);
            result.SourceFilePath = filePath;
            result.SourceFileSizeBytes = new FileInfo(filePath).Length;
            return result;
        }

        /// <summary>
        /// Parse raw Playwright Codegen TypeScript content.
        /// Generic: works for any Playwright Codegen recording, not application-specific.
        /// </summary>
        public CodegenParseResult Parse(string content)
        {
            if (string.IsNullOrWhiteSpace(content))
                return CodegenParseResult.Empty();

            var actions = new List<RecordedActionIntelligence>();
            var sequence = 0;
            var currentPageContext = (string)null;
            var linesProcessed = 0;

            var testName = ExtractTestName(content);
            var lines = content.Split('\n');

            foreach (var rawLine in lines)
            {
                linesProcessed++;
                var line = rawLine.Trim();

                if (!line.StartsWith("await page."))
                    continue;

                var action = ParseLine(line, sequence, ref currentPageContext);
                if (action == null)
                    continue;

                actions.Add(action);
                sequence++;
            }

            return new CodegenParseResult
            {
                TestName     = testName,
                Actions      = actions,
                TotalLines   = linesProcessed,
                ParsedAt     = DateTime.UtcNow,
                Fields       = DocumentFieldOrigins(actions)
            };
        }

        // ===== Line-level parsing =====

        private RecordedActionIntelligence ParseLine(string line, int sequence, ref string currentPageContext)
        {
            // 1. goto (navigation)
            var gotoMatch = GotoPattern.Match(line);
            if (gotoMatch.Success)
            {
                var url = gotoMatch.Groups[1].Value;
                var inferred = InferPageFromUrl(url);
                if (inferred != null)
                    currentPageContext = inferred;

                return new RecordedActionIntelligence
                {
                    Sequence            = sequence,
                    ActionType          = "navigate",
                    Target              = url,
                    LocatorType         = "url",
                    LocatorValue        = url,
                    InferredPageContext = currentPageContext
                };
            }

            // 2. getByRole
            var roleMatch = GetByRolePattern.Match(line);
            if (roleMatch.Success)
            {
                var role   = roleMatch.Groups[1].Value;
                var name   = roleMatch.Groups[2].Value;
                var action = ResolveChainedAction(line);

                // If clicking a link, infer new page context
                if (role == "link" && action == "click")
                    currentPageContext = InferPageFromLinkName(name, currentPageContext);

                return new RecordedActionIntelligence
                {
                    Sequence            = sequence,
                    ActionType          = action,
                    Target              = name,
                    LocatorType         = "role",
                    LocatorValue        = $"getByRole('{role}', {{ name: '{name}' }})",
                    GetByRoleName       = name,
                    InferredPageContext = currentPageContext
                };
            }

            // 3. getByLabel
            var labelMatch = GetByLabelPattern.Match(line);
            if (labelMatch.Success)
            {
                var label  = labelMatch.Groups[1].Value;
                var action = ResolveChainedAction(line);
                return new RecordedActionIntelligence
                {
                    Sequence            = sequence,
                    ActionType          = action,
                    Target              = label,
                    LocatorType         = "label",
                    LocatorValue        = $"getByLabel('{label}')",
                    InferredPageContext = currentPageContext
                };
            }

            // 4. getByPlaceholder
            var phMatch = GetByPlaceholderPattern.Match(line);
            if (phMatch.Success)
            {
                var ph     = phMatch.Groups[1].Value;
                var action = ResolveChainedAction(line);
                return new RecordedActionIntelligence
                {
                    Sequence            = sequence,
                    ActionType          = action,
                    Target              = ph,
                    LocatorType         = "placeholder",
                    LocatorValue        = $"getByPlaceholder('{ph}')",
                    InferredPageContext = currentPageContext
                };
            }

            // 5. getByText
            var textMatch = GetByTextPattern.Match(line);
            if (textMatch.Success)
            {
                var text   = textMatch.Groups[1].Value;
                var action = ResolveChainedAction(line);
                return new RecordedActionIntelligence
                {
                    Sequence            = sequence,
                    ActionType          = action,
                    Target              = text,
                    LocatorType         = "text",
                    LocatorValue        = $"getByText('{text}')",
                    InferredPageContext = currentPageContext
                };
            }

            // 6. locator(selector) — CSS/ID
            var locatorMatch = LocatorPattern.Match(line);
            if (locatorMatch.Success)
            {
                var selector  = locatorMatch.Groups[1].Value;
                var locType   = DetermineLocatorType(selector);
                var action    = ResolveChainedAction(line);
                var target    = InferTargetFromSelector(selector);

                return new RecordedActionIntelligence
                {
                    Sequence            = sequence,
                    ActionType          = action,
                    Target              = target,
                    LocatorType         = locType,
                    LocatorValue        = selector,
                    InferredPageContext = currentPageContext
                };
            }

            return null;
        }

        // ===== Chained action resolution =====

        /// <summary>
        /// Determines the final action type from the chain suffix on the line.
        /// e.g. ...getByRole(...).click()  → "click"
        ///      ...locator(...).selectOption('x') → "selectOption"
        /// </summary>
        private string ResolveChainedAction(string line)
        {
            if (SelectSuffix.IsMatch(line))   return "selectOption";
            if (CheckSuffix.IsMatch(line))    return "check";
            if (UncheckSuffix.IsMatch(line))  return "uncheck";
            if (FillSuffix.IsMatch(line))     return "fill";
            if (TypeSuffix.IsMatch(line))     return "fill";
            if (HoverSuffix.IsMatch(line))    return "hover";
            if (PressKeySuffix.IsMatch(line)) return "pressKey";
            if (ClickSuffix.IsMatch(line))    return "click";
            return "interact";
        }

        // ===== Locator classification =====

        private string DetermineLocatorType(string selector)
        {
            if (selector.StartsWith("#"))  return "id";
            if (selector.StartsWith("."))  return "css";
            if (selector.StartsWith("//") || selector.StartsWith("(//")) return "xpath";
            return "css";
        }

        // ===== Target name inference =====

        /// <summary>
        /// Infers a human-readable target name from a CSS/ID selector.
        /// Generic: applies common naming prefix conventions, not app-specific logic.
        /// </summary>
        private string InferTargetFromSelector(string selector)
        {
            if (!selector.StartsWith("#"))
                return selector;

            var id    = selector.TrimStart('#');
            var parts = id.Split('_');

            // Strip generic ASP.NET scaffold segments
            var meaningful = parts
                .Where(p => !string.IsNullOrEmpty(p)
                         && !Regex.IsMatch(p, @"^ctl\d+$", RegexOptions.IgnoreCase)
                         && !p.Equals("ContentPlaceHolder1", StringComparison.OrdinalIgnoreCase)
                         && !p.Equals("ContentPlaceHolder", StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (meaningful.Count == 0) return id;

            var last = meaningful.Last();
            return ApplyControlPrefixConvention(last);
        }

        /// <summary>
        /// Maps common Hungarian-notation prefixes to readable element names.
        /// Generic: not tied to any specific application.
        /// </summary>
        private string ApplyControlPrefixConvention(string raw)
        {
            if (raw.Length < 4) return raw;

            var prefix = raw.Substring(0, 3).ToLower();
            var rest   = raw.Substring(3);

            return prefix switch
            {
                "ddl" => Capitalise(rest) + "Dropdown",
                "chk" => Capitalise(rest) + "Checkbox",
                "txt" => Capitalise(rest) + "TextBox",
                "btn" => Capitalise(rest) + "Button",
                "lnk" => Capitalise(rest) + "Link",
                "lbl" => Capitalise(rest) + "Label",
                "grd" => Capitalise(rest) + "Grid",
                _     => raw
            };
        }

        private static string Capitalise(string s) =>
            string.IsNullOrEmpty(s) ? s : char.ToUpper(s[0]) + s.Substring(1);

        // ===== Page context inference =====

        /// <summary>
        /// Derives a page name from a URL path.
        /// Returns null when the path provides no useful information.
        /// PURELY deterministic — no guessing about application domain.
        /// </summary>
        private string InferPageFromUrl(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
                return null;

            var path    = uri.LocalPath.TrimStart('/');
            var segment = Path.GetFileNameWithoutExtension(path);

            // Root path or empty — call it Home
            if (string.IsNullOrEmpty(segment))
                return "Home";

            return segment; // e.g. "Default" from "/Default.aspx"
        }

        /// <summary>
        /// Derives a page name from a link label by converting it to PascalCase.
        /// Falls back to current page context if label is empty.
        /// </summary>
        private string InferPageFromLinkName(string linkName, string currentPage)
        {
            if (string.IsNullOrWhiteSpace(linkName))
                return currentPage;

            // Normalise to PascalCase words, strip spaces/hyphens
            var parts = linkName.Split(new[] { ' ', '-', '_' }, StringSplitOptions.RemoveEmptyEntries);
            return string.Concat(parts.Select(p => Capitalise(p)));
        }

        // ===== Test name =====

        private string ExtractTestName(string content)
        {
            var m = TestNamePattern.Match(content);
            return m.Success ? m.Groups[1].Value : null;
        }

        // ===== Field origin documentation (Task 5 evidence) =====

        private CodegenFieldOrigins DocumentFieldOrigins(List<RecordedActionIntelligence> actions)
        {
            return new CodegenFieldOrigins
            {
                DirectlyFromCodets = new[]
                {
                    "ActionType    — from Playwright method chain suffix (.click, .selectOption, .check, .fill, …)",
                    "Target        — from role name / label / placeholder / inferred selector fragment",
                    "LocatorType   — from Playwright locator strategy (role, id, css, label, text, …)",
                    "LocatorValue  — raw selector string from code.ts",
                    "GetByRoleName — from getByRole({ name: '…' })",
                    "Sequence      — ordinal position of await page.* line"
                },
                DeterministicInference = new[]
                {
                    "InferredPageContext — from URL path segment or link-click page transition",
                    "Target (id locators) — from last meaningful segment of ASP.NET id, prefix convention applied"
                },
                CannotBeInferred = new[]
                {
                    "RelatedPageElement — requires repository index matching (done in RecordingIntelligenceBuilder)",
                    "RelatedPageAction  — requires repository index matching",
                    "RelatedStep        — requires repository index matching",
                    "Business domain knowledge — names like 'PackageReassignment' require human or AI labelling"
                }
            };
        }
    }

    // ===== Result types =====

    /// <summary>
    /// Output of CodegenParser.Parse() or ParseFile().
    /// Contains the raw parsed actions and metadata about the parse.
    /// </summary>
    public class CodegenParseResult
    {
        public string SourceFilePath     { get; set; }
        public long   SourceFileSizeBytes { get; set; }
        public string TestName           { get; set; }
        public int    TotalLines         { get; set; }
        public DateTime ParsedAt         { get; set; }

        public List<RecordedActionIntelligence> Actions { get; set; } = new();
        public CodegenFieldOrigins Fields { get; set; }

        public int ActionCount => Actions.Count;

        public static CodegenParseResult Empty() => new()
        {
            Actions  = new(),
            ParsedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Documents exactly which fields come from code.ts directly,
    /// which are deterministic inference, and which cannot be inferred.
    /// Required for Task 5 evidence report.
    /// </summary>
    public class CodegenFieldOrigins
    {
        public string[] DirectlyFromCodets      { get; set; } = Array.Empty<string>();
        public string[] DeterministicInference  { get; set; } = Array.Empty<string>();
        public string[] CannotBeInferred        { get; set; } = Array.Empty<string>();
    }
}

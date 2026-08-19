using AutomationFrameWork.Models;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using OxTable = DocumentFormat.OpenXml.Wordprocessing.Table;
using OxTableRow = DocumentFormat.OpenXml.Wordprocessing.TableRow;
using OxTableCell = DocumentFormat.OpenXml.Wordprocessing.TableCell;
using DocumentFormat.OpenXml.Wordprocessing;

namespace AutomationFrameWork.Helpers
{
    public class AccrualsWordReportWriter
    {
        private static readonly string DarkBlue      = "1F3864";
        private static readonly string MidBlue       = "2F5496";
        private static readonly string LightBlue     = "D9E1F2";
        private static readonly string PassGreen     = "C6EFCE";
        private static readonly string FailRed       = "FFC7CE";
        private static readonly string WarningYellow = "FFEB9C";
        private static readonly string LightGray     = "F2F2F2";

        private static readonly Dictionary<string, (string label, string description)> FieldDescriptions = new()
        {
            ["PrincipalBalance (H)"]             = ("Principal Balance",          "The loan amount — money lender gave to borrower that has not been repaid yet"),
            ["DailyAccrual (I)"]                 = ("Daily Interest",              "Interest earned each day = Principal x Interest Rate / 360"),
            ["AccumulatedOnOriginal (J)"]        = ("Total Interest Accumulated",  "Running total of all daily interest built up so far"),
            ["CompoundedBasis (K)"]              = ("Compound Basis",              "The interest amount locked in at the 1-year anniversary to start compounding"),
            ["DailyAccrualOnCompound (L)"]       = ("Daily Compound Interest",     "Interest charged on accumulated interest — only starts after 1 year"),
            ["AccumulatedOnCompounded (M)"]      = ("Total Compound Interest",     "Running total of compound interest accumulated so far"),
            ["TotalBalance (N)"]                 = ("Total Balance",               "Total amount owed = Principal + All Accumulated Interest"),
            ["Advances (O)"]                     = ("Money Received from Lender",  "Amount the borrower received from the lender on this date"),
            ["TotalRepayments (P)"]              = ("Total Repayments",            "Total amount the borrower paid back on this date"),
            ["PrincipalRepayment (Q)"]           = ("Principal Repaid",            "Portion of the repayment that reduced the loan principal"),
            ["InterestOnOriginalRepayment (S)"]  = ("Interest Repaid",             "Portion of the repayment that cleared accumulated interest"),
            ["OverpaymentBalance (X)"]           = ("Overpayment Balance",         "Excess repayment beyond the principal — held as credit for future advances"),
            ["IOAOverpaymentBalance (Y)"]        = ("IOA Overpayment Balance",     "Excess IOA repayment beyond all interest — held as credit"),
            ["OverpaymentAllocation (Z)"]        = ("Overpayment Used",            "Amount from overpayment credit applied against a new advance"),
        };

        public string WriteReport(
            List<AccrualValidationResult> results,
            string sourceFileName,
            string idealFileName,
            string outputFolder)
        {
            Directory.CreateDirectory(outputFolder);
            var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            var path = Path.Combine(outputFolder, $"DailyAccrualsValidationReport_{timestamp}.docx");

            using var doc = WordprocessingDocument.Create(path, WordprocessingDocumentType.Document);
            var main = doc.AddMainDocumentPart();
            main.Document = new Document();
            var body = main.Document.AppendChild(new Body());

            AddPageMargins(body);

            var failures = results
                .Where(r => !r.IsValid)
                .OrderBy(r => r.AccrualDate)
                .ThenBy(r => r.AdvanceType)
                .ToList();
            var overallPass = failures.Count == 0;

            AddTitle(body, overallPass);
            AddOverallBanner(body, overallPass, results.Count, failures.Count);
            Spacer(body);
            AddSection1(body, sourceFileName, idealFileName, results);
            AddSection2(body, results, failures);

            if (failures.Any())
            {
                AddPageBreak(body);
                AddSection3(body, failures);
                AddPageBreak(body);
                AddSection4(body, failures);
            }
            else
            {
                AddAllPassedBox(body);
            }

            main.Document.Save();
            return path;
        }

        private static void AddTitle(Body body, bool passed)
        {
            body.AppendChild(Para(
                RunText("Daily Accruals Validation Report", bold: true, size: "40", color: DarkBlue),
                center: true, after: "80"));
            body.AppendChild(Para(
                RunText($"Generated on {DateTime.Now:dd MMM yyyy} at {DateTime.Now:HH:mm:ss}", size: "20", color: "808080"),
                center: true, after: "60"));
        }

        private static void AddOverallBanner(Body body, bool passed, int total, int failCount)
        {
            var bg   = passed ? PassGreen : FailRed;
            var line1 = passed ? "ALL CHECKS PASSED" : $"{failCount} ISSUE(S) FOUND";
            var line2 = passed
                ? $"All {total} daily accrual rows in the validation file are correctly calculated."
                : $"{failCount} out of {total} rows have differences between the source transactions and the validation file.";

            var tbl = BordTable(body);
            var row = new OxTableRow();
            row.AppendChild(MultilineCell(new[] { (line1, true, "28", "000000"), (line2, false, "20", "404040") }, bg));
            tbl.AppendChild(row);
        }

        private static void AddSection1(Body body, string sourceFile, string idealFile, List<AccrualValidationResult> results)
        {
            SectionHeading(body, "1.  What Was Tested");
            AddPara(body, "This report checks whether the daily interest calculations in the validation file are correct, based on the actual loan transactions in the source file.", italic: true, color: "404040");
            Spacer(body);
            var tbl = BordTable(body);
            InfoRow(tbl, "Source File (Loan Transactions)", sourceFile, "Lists every advance and repayment between lender and borrower");
            InfoRow(tbl, "Validation File (Expected Results)", idealFile, "Contains the expected daily accrual calculations to be verified");
            InfoRow(tbl, "Date Range",
                results.Any() ? $"{results.Min(r => r.AccrualDate):dd MMM yyyy}  to  {results.Max(r => r.AccrualDate):dd MMM yyyy}" : "N/A",
                "The period covered by the validation file");
            InfoRow(tbl, "Total Rows Checked", results.Count.ToString(), "One row per loan type per calendar day");
            Spacer(body);
            AddPara(body,
                "How it works:  The system reads every transaction from the source file, then re-calculates " +
                "the principal balance, daily interest, accumulated interest, compound interest, and total balance " +
                "day by day for each loan type. Each calculated number is then compared against the value in the validation file.",
                color: "595959");
            Spacer(body);
        }

        private static void AddSection2(Body body, List<AccrualValidationResult> results, List<AccrualValidationResult> failures)
        {
            SectionHeading(body, "2.  Summary");
            var tbl = BordTable(body);
            AddHeaderRow(tbl, new[] { "Loan Type", "Days Checked", "Days Correct", "Days with Issues", "Status" });

            foreach (var g in results.Where(r => r.AdvanceType != "[Cross-Row Constraint]")
                                     .GroupBy(r => r.AdvanceType).OrderBy(g => g.Key))
            {
                var fail = g.Count(r => !r.IsValid);
                var pass = g.Count() - fail;
                var bg   = fail == 0 ? PassGreen : FailRed;
                AddRow(tbl, new[] { g.Key, g.Count().ToString(), pass.ToString(), fail.ToString(), fail == 0 ? "Correct" : $"{fail} issue(s)" },
                       new[] { (string?)null, LightGray, PassGreen, fail > 0 ? FailRed : PassGreen, bg });
            }

            var crossFails = failures.Where(r => r.AdvanceType == "[Cross-Row Constraint]").ToList();
            if (crossFails.Any())
                AddRow(tbl, new[] { "IOA Repayment Split", crossFails.Count.ToString(), "0", crossFails.Count.ToString(), $"{crossFails.Count} issue(s)" },
                       new[] { (string?)null, LightGray, FailRed, FailRed, FailRed });

            Spacer(body);

            if (failures.Any())
            {
                AddPara(body, "Which types of calculations are wrong?", bold: true);
                var ftbl = BordTable(body);
                AddHeaderRow(ftbl, new[] { "Calculation", "Plain English Meaning", "Number of Wrong Days" });
                foreach (var fg in failures.SelectMany(f => f.Mismatches)
                                           .GroupBy(m => m.Split(':')[0].Trim())
                                           .OrderByDescending(g => g.Count()))
                {
                    var lbl = FieldDescriptions.TryGetValue(fg.Key, out var d) ? d.label : fg.Key;
                    AddRow(ftbl, new[] { fg.Key, lbl, fg.Count().ToString() },
                           new[] { (string?)null, (string?)null, FailRed });
                }
                Spacer(body);
            }
        }

        private static void AddSection3(Body body, List<AccrualValidationResult> failures)
        {
            SectionHeading(body, "3.  What Went Wrong — Date by Date");
            AddPara(body,
                "Each entry below shows one date that has calculation errors. " +
                "For every failing date you can see: what the issue is in plain language, " +
                "what value was calculated from the source transactions, " +
                "and what the validation file actually shows.",
                italic: true, color: "404040");
            Spacer(body);

            // Group by date → then by advance type
            var byDate = failures
                .Where(f => f.AdvanceType != "[Cross-Row Constraint]")
                .GroupBy(f => f.AccrualDate.Date)
                .OrderBy(g => g.Key)
                .ToList();

            foreach (var dateGroup in byDate)
            {
                var date = dateGroup.Key;

                // Date heading banner
                var banner = BordTable(body);
                var bhr = new OxTableRow();
                bhr.AppendChild(Cell($"Date:  {date:dd MMM yyyy}", bold: true, bg: MidBlue, fg: "FFFFFF", size: "24"));
                banner.AppendChild(bhr);

                foreach (var failRow in dateGroup.OrderBy(r => r.AdvanceType))
                {
                    // Sub-heading: loan type
                    AddPara(body, $"  Loan Type:  {failRow.AdvanceType}", bold: true, color: DarkBlue);

                    // Table: field | plain English | calculated | validation file | difference
                    var tbl = BordTable(body);
                    AddHeaderRow(tbl, new[] { "What Failed", "Plain English Meaning", "Calculated (Source)", "Validation File", "Difference", "Over/Under" });

                    foreach (var mismatch in failRow.Mismatches)
                    {
                        var field = mismatch.Split(':')[0].Trim();
                        var fi    = FieldDescriptions.TryGetValue(field, out var d) ? d : (label: field, description: field);
                        var parts = mismatch.Split(new[] { ": expected=", ", actual=", ", diff=" }, StringSplitOptions.None);
                        decimal exp = 0, act = 0;
                        if (parts.Length > 1) decimal.TryParse(parts[1], out exp);
                        if (parts.Length > 2) decimal.TryParse(parts[2], out act);
                        var direction = exp > act ? "Validation file is LOWER" : "Validation file is HIGHER";
                        var dirBg     = exp > act ? FailRed : WarningYellow;

                        AddRow(tbl,
                            new[] { fi.label, fi.description, Fmt(exp), Fmt(act), Fmt(Math.Abs(exp - act)), direction },
                            new[] { LightBlue, (string?)null, PassGreen, FailRed, WarningYellow, dirBg });
                    }

                    Spacer(body);
                }
            }

            // Cross-row constraint failures
            foreach (var cf in failures.Where(f => f.AdvanceType == "[Cross-Row Constraint]"))
            {
                var parts = cf.Mismatches.First().Split(new[] { ": expected=", ", actual sum=", ", diff=" }, StringSplitOptions.None);
                decimal expS = 0, actS = 0;
                if (parts.Length > 1) decimal.TryParse(parts[1], out expS);
                if (parts.Length > 2) decimal.TryParse(parts[2], out actS);

                var banner = BordTable(body);
                var bhr = new OxTableRow();
                bhr.AppendChild(Cell($"Date:  {cf.AccrualDate:dd MMM yyyy}  |  IOA Repayment Split Check", bold: true, bg: MidBlue, fg: "FFFFFF", size: "24"));
                banner.AppendChild(bhr);

                AddPara(body,
                    $"On {cf.AccrualDate:dd MMM yyyy}, the borrower overpaid the IOA balance. The excess amount must be spread across other loan types to reduce their accumulated interest. " +
                    $"The calculated excess was {Fmt(expS)}, but the total of amounts shown in the validation file adds up to only {Fmt(actS)}. " +
                    $"The {Fmt(Math.Abs(expS - actS))} gap means the split in the validation file does not add up correctly.",
                    color: "404040");

                var tbl = BordTable(body);
                AddHeaderRow(tbl, new[] { "Detail", "Value" });
                AddRow(tbl, new[] { "Calculated excess to distribute", Fmt(expS) }, new[] { LightGray, PassGreen });
                AddRow(tbl, new[] { "Sum of amounts in validation file", Fmt(actS) }, new[] { LightGray, FailRed });
                AddRow(tbl, new[] { "Unaccounted difference", Fmt(Math.Abs(expS - actS)) }, new[] { LightGray, WarningYellow });

                Spacer(body);
            }
        }

        private static void AddSection4(Body body, List<AccrualValidationResult> failures)
        {
            SectionHeading(body, "4.  Technical Details  —  All Failed Rows");
            AddPara(body, "This table lists every failed row with exact values for reference.", italic: true, color: "595959");
            Spacer(body);
            var tbl = BordTable(body);
            AddHeaderRow(tbl, new[] { "Date", "Loan Type", "What Failed", "Calculated", "Validation File", "Difference" });

            foreach (var f in failures.Where(f => f.AdvanceType != "[Cross-Row Constraint]"))
                foreach (var m in f.Mismatches)
                {
                    var lbl   = FieldDescriptions.TryGetValue(m.Split(':')[0].Trim(), out var dd) ? dd.label : m.Split(':')[0].Trim();
                    var parts = m.Split(new[] { ": expected=", ", actual=", ", diff=" }, StringSplitOptions.None);
                    var exp   = parts.Length > 1 ? parts[1] : "?";
                    var act   = parts.Length > 2 ? parts[2] : "?";
                    var dif   = parts.Length > 3 ? parts[3] : "?";
                    AddRow(tbl, new[] { f.AccrualDate.ToString("dd-MMM-yyyy"), f.AdvanceType, lbl, exp, act, dif },
                           new[] { LightGray, (string?)null, (string?)null, PassGreen, FailRed, WarningYellow });
                }
        }

        private static void AddAllPassedBox(Body body)
        {
            Spacer(body);
            var tbl = BordTable(body);
            var row = new OxTableRow();
            row.AppendChild(MultilineCell(new[]
            {
                ("ALL CALCULATIONS ARE CORRECT", true, "28", "000000"),
                ("Every daily accrual row in the validation file matches the calculations from the source transactions. " +
                 "The principal, interest, compound interest, total balance, advances, repayments, and overpayments are all correct.", false, "20", "404040")
            }, PassGreen));
            tbl.AppendChild(row);
        }

        private static string PlainExplanation(string field, string advType, string label, int count,
            DateTime first, DateTime last, decimal exp, decimal act)
        {
            var when = count == 1 ? $"on {first:dd MMM yyyy}" : $"from {first:dd MMM yyyy} to {last:dd MMM yyyy} ({count} days)";
            var dir  = exp > act ? "higher" : "lower";

            return field switch
            {
                "PrincipalBalance (H)" =>
                    $"The loan principal for '{advType}' {when} is {dir} in the validation file than what the source transactions show. " +
                    $"After applying all advances and repayments from the source file, the principal should be {Fmt(exp)}, " +
                    $"but the validation file shows {Fmt(act)}. " +
                    $"This may mean a transaction was missed, an amount was wrong, or a repayment was not applied correctly.",

                "DailyAccrual (I)" =>
                    $"The daily interest for '{advType}' {when} does not match. " +
                    $"The formula is: Daily Interest = Principal x Interest Rate / 360. " +
                    $"Based on the calculated principal, daily interest should be {Fmt(exp)}, but the validation file shows {Fmt(act)}. " +
                    $"This is usually caused by the principal balance being wrong.",

                "AccumulatedOnOriginal (J)" =>
                    $"The total accumulated interest for '{advType}' {when} is wrong. " +
                    $"This is the running total of all daily interest added up since the loan started. " +
                    $"It should be {Fmt(exp)} but the validation file shows {Fmt(act)}.",

                "CompoundedBasis (K)" =>
                    $"The compound basis for '{advType}' is wrong. " +
                    $"After exactly one year, the accumulated interest is locked in as the starting point for compound interest. " +
                    $"This locked value should be {Fmt(exp)} but the validation file shows {Fmt(act)}.",

                "DailyAccrualOnCompound (L)" =>
                    $"The daily compound interest for '{advType}' {when} does not match. " +
                    $"This is interest charged on top of the already accumulated interest (compounding), which starts after 1 year. " +
                    $"It should be {Fmt(exp)} but the validation file shows {Fmt(act)}.",

                "AccumulatedOnCompounded (M)" =>
                    $"The total accumulated compound interest for '{advType}' {when} does not match. " +
                    $"Should be {Fmt(exp)} but the validation file shows {Fmt(act)}.",

                "TotalBalance (N)" =>
                    $"The total balance for '{advType}' {when} is {dir} than expected. " +
                    $"Total balance = Principal + Accumulated Interest + Compound Interest. " +
                    $"It should be {Fmt(exp)} but the validation file shows {Fmt(act)}.",

                "Advances (O)" =>
                    $"The advance amount for '{advType}' on {first:dd MMM yyyy} does not match. " +
                    $"The source file shows the lender gave {Fmt(exp)} to the borrower, " +
                    $"but the validation file records {Fmt(act)}.",

                "TotalRepayments (P)" =>
                    $"The repayment amount for '{advType}' on {first:dd MMM yyyy} does not match. " +
                    $"The source file shows the borrower paid back {Fmt(exp)}, " +
                    $"but the validation file shows {Fmt(act)}.",

                "PrincipalRepayment (Q)" =>
                    $"The principal repayment for '{advType}' on {first:dd MMM yyyy} is wrong. " +
                    $"This is the portion of the repayment that reduced the loan principal. " +
                    $"It should be {Fmt(exp)} but the validation file shows {Fmt(act)}.",

                "InterestOnOriginalRepayment (S)" =>
                    $"The interest repayment for '{advType}' on {first:dd MMM yyyy} is wrong. " +
                    $"This is the portion of the repayment used to clear accumulated interest. " +
                    $"It should be {Fmt(exp)} but the validation file shows {Fmt(act)}.",

                "OverpaymentBalance (X)" =>
                    $"The overpayment balance for '{advType}' {when} is wrong. " +
                    $"This holds any excess repayment beyond the principal, kept as credit for future advances. " +
                    $"It should be {Fmt(exp)} but the validation file shows {Fmt(act)}.",

                "IOAOverpaymentBalance (Y)" =>
                    $"The IOA overpayment balance {when} is wrong. " +
                    $"This holds excess from an IOA repayment that went beyond all interest amounts. " +
                    $"It should be {Fmt(exp)} but the validation file shows {Fmt(act)}.",

                "OverpaymentAllocation (Z)" =>
                    $"The overpayment credit used on {first:dd MMM yyyy} for '{advType}' does not match. " +
                    $"This is the portion of a new advance offset by the existing overpayment credit. " +
                    $"It should be {Fmt(exp)} but the validation file shows {Fmt(act)}.",

                _ =>
                    $"The value for '{label}' for '{advType}' {when} does not match. " +
                    $"Expected {Fmt(exp)} but the validation file shows {Fmt(act)}."
            };
        }

        // ─── Low-level helpers ────────────────────────────────────────────────────
        private static void AddPageMargins(Body body) =>
            body.AppendChild(new SectionProperties(new PageMargin { Top = 720, Bottom = 720, Left = 900, Right = 900 }));

        private static void AddPageBreak(Body body) =>
            body.AppendChild(new Paragraph(new Run(new Break { Type = BreakValues.Page })));

        private static void Spacer(Body body) =>
            body.AppendChild(new Paragraph(new ParagraphProperties(new SpacingBetweenLines { After = "160" })));

        private static void SectionHeading(Body body, string text) =>
            body.AppendChild(new Paragraph(
                new ParagraphProperties(
                    new SpacingBetweenLines { Before = "320", After = "160" },
                    new ParagraphBorders(new BottomBorder { Val = BorderValues.Single, Size = 6, Color = MidBlue })),
                new Run(new RunProperties(new Bold(), new FontSize { Val = "32" }, new Color { Val = DarkBlue }),
                    new Text(text))));

        private static void AddPara(Body body, string text, bool bold = false, bool italic = false, string color = "000000") =>
            body.AppendChild(new Paragraph(
                new ParagraphProperties(new SpacingBetweenLines { After = "100" }),
                new Run(BuildRp(bold, italic, "20", color), new Text(text))));

        private static Paragraph Para(Run run, bool center = false, string after = "100")
        {
            var pp = new ParagraphProperties(new SpacingBetweenLines { After = after });
            if (center) pp.AppendChild(new Justification { Val = JustificationValues.Center });
            return new Paragraph(pp, run);
        }

        private static Run RunText(string text, bool bold = false, string size = "20", string color = "000000") =>
            new Run(BuildRp(bold, false, size, color), new Text(text));

        private static RunProperties BuildRp(bool bold, bool italic, string size, string color)
        {
            var rp = new RunProperties();
            if (bold)   rp.AppendChild(new Bold());
            if (italic) rp.AppendChild(new Italic());
            rp.AppendChild(new FontSize { Val = size });
            rp.AppendChild(new Color { Val = color });
            return rp;
        }

        private static OxTable BordTable(Body body)
        {
            var tbl = new OxTable(new TableProperties(
                new TableWidth { Width = "5000", Type = TableWidthUnitValues.Pct },
                new TableBorders(
                    new TopBorder    { Val = BorderValues.Single, Size = 6, Color = "AAAAAA" },
                    new BottomBorder { Val = BorderValues.Single, Size = 6, Color = "AAAAAA" },
                    new LeftBorder   { Val = BorderValues.Single, Size = 6, Color = "AAAAAA" },
                    new RightBorder  { Val = BorderValues.Single, Size = 6, Color = "AAAAAA" },
                    new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4, Color = "CCCCCC" },
                    new InsideVerticalBorder   { Val = BorderValues.Single, Size = 4, Color = "CCCCCC" })));
            body.AppendChild(tbl);
            return tbl;
        }

        private static void AddHeaderRow(OxTable tbl, string[] headers)
        {
            var row = new OxTableRow();
            foreach (var h in headers)
                row.AppendChild(Cell(h, bold: true, bg: DarkBlue, fg: "FFFFFF", size: "18"));
            tbl.AppendChild(row);
        }

        private static void AddRow(OxTable tbl, string?[] vals, string?[] bgs)
        {
            var row = new OxTableRow();
            for (int i = 0; i < vals.Length; i++)
                row.AppendChild(Cell(vals[i] ?? "", bold: false, bg: bgs[i], size: "18"));
            tbl.AppendChild(row);
        }

        private static void InfoRow(OxTable tbl, string label, string value, string hint)
        {
            var row = new OxTableRow();
            row.AppendChild(Cell(label, bold: true,  bg: LightBlue, size: "18"));
            row.AppendChild(Cell(value, bold: false, size: "18"));
            row.AppendChild(Cell(hint,  bold: false, bg: LightGray, size: "16", fg: "595959"));
            tbl.AppendChild(row);
        }

        private static OxTableCell Cell(string text, bool bold = false, string? bg = null,
            string? fg = null, string size = "18")
        {
            var rp = BuildRp(bold, false, size, fg ?? "000000");
            var cp = new TableCellProperties(new TableCellMargin(
                new TopMargin    { Width = "80",  Type = TableWidthUnitValues.Dxa },
                new BottomMargin { Width = "80",  Type = TableWidthUnitValues.Dxa },
                new LeftMargin   { Width = "120", Type = TableWidthUnitValues.Dxa },
                new RightMargin  { Width = "120", Type = TableWidthUnitValues.Dxa }));
            if (bg != null) cp.AppendChild(new Shading { Val = ShadingPatternValues.Clear, Fill = bg });
            var cell = new OxTableCell();
            cell.AppendChild(cp);
            cell.AppendChild(new Paragraph(new Run(rp, new Text(text))));
            return cell;
        }

        private static OxTableCell MultilineCell(
            (string text, bool bold, string size, string color)[] lines, string? bg)
        {
            var cp = new TableCellProperties(new TableCellMargin(
                new TopMargin    { Width = "120", Type = TableWidthUnitValues.Dxa },
                new BottomMargin { Width = "120", Type = TableWidthUnitValues.Dxa },
                new LeftMargin   { Width = "160", Type = TableWidthUnitValues.Dxa },
                new RightMargin  { Width = "160", Type = TableWidthUnitValues.Dxa }));
            if (bg != null) cp.AppendChild(new Shading { Val = ShadingPatternValues.Clear, Fill = bg });

            var cell = new OxTableCell();
            cell.AppendChild(cp);
            foreach (var (text, bold, size, color) in lines)
                cell.AppendChild(new Paragraph(
                    new ParagraphProperties(new SpacingBetweenLines { After = "60" }),
                    new Run(BuildRp(bold, false, size, color), new Text(text))));
            return cell;
        }

        private static string Fmt(decimal v) =>
            v == 0m ? "$0.00" : v >= 1000m || v <= -1000m ? $"${v:N2}" : $"${v:F4}";
    }
}

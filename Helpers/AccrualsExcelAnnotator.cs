using ClosedXML.Excel;
using AutomationFrameWork.Models;

namespace AutomationFrameWork.Helpers
{
    public class AccrualsExcelAnnotator
    {
        // Column number in the ideal file for each field key
        private static readonly Dictionary<string, int> FieldColumnMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["PrincipalBalance (H)"]             = 8,
            ["DailyAccrual (I)"]                 = 9,
            ["AccumulatedOnOriginal (J)"]        = 10,
            ["CompoundedBasis (K)"]              = 11,
            ["DailyAccrualOnCompound (L)"]       = 12,
            ["AccumulatedOnCompounded (M)"]      = 13,
            ["TotalBalance (N)"]                 = 14,
            ["Advances (O)"]                     = 15,
            ["TotalRepayments (P)"]              = 16,
            ["PrincipalRepayment (Q)"]           = 17,
            ["InterestOnOriginalRepayment (S)"]  = 19,
            ["OverpaymentBalance (X)"]           = 24,
            ["IOAOverpaymentBalance (Y)"]        = 25,
            ["OverpaymentAllocation (Z)"]        = 26,
        };

        private static readonly Dictionary<string, string> FieldLabels = new(StringComparer.OrdinalIgnoreCase)
        {
            ["PrincipalBalance (H)"]             = "Principal Balance",
            ["DailyAccrual (I)"]                 = "Daily Interest",
            ["AccumulatedOnOriginal (J)"]        = "Total Interest Accumulated",
            ["CompoundedBasis (K)"]              = "Compound Basis",
            ["DailyAccrualOnCompound (L)"]       = "Daily Compound Interest",
            ["AccumulatedOnCompounded (M)"]      = "Total Compound Interest",
            ["TotalBalance (N)"]                 = "Total Balance",
            ["Advances (O)"]                     = "Money Received from Lender",
            ["TotalRepayments (P)"]              = "Total Repayments",
            ["PrincipalRepayment (Q)"]           = "Principal Repaid",
            ["InterestOnOriginalRepayment (S)"]  = "Interest Repaid",
            ["OverpaymentBalance (X)"]           = "Overpayment Balance",
            ["IOAOverpaymentBalance (Y)"]        = "IOA Overpayment Balance",
            ["OverpaymentAllocation (Z)"]        = "Overpayment Used",
        };

        public void AnnotateAndWriteErrorSheet(
            string idealFilePath,
            List<AccrualValidationResult> results)
        {
            var failures = results
                .Where(r => !r.IsValid)
                .OrderBy(r => r.AccrualDate)
                .ThenBy(r => r.AdvanceType)
                .ToList();

            using var wb = new XLWorkbook(idealFilePath);
            var dataSheet = wb.Worksheet(1);

            // Build lookup: (date, advanceType) → row number in Excel
            var rowIndex = BuildRowIndex(dataSheet);

            // Step 1: Highlight failing cells red in the data sheet
            foreach (var failure in failures.Where(f => f.AdvanceType != "[Cross-Row Constraint]"))
            {
                var key = (failure.AccrualDate.Date, failure.AdvanceType);
                if (!rowIndex.TryGetValue(key, out var excelRow)) continue;

                foreach (var mismatch in failure.Mismatches)
                {
                    var field = mismatch.Split(':')[0].Trim();
                    if (!FieldColumnMap.TryGetValue(field, out var col)) continue;

                    var cell = dataSheet.Cell(excelRow, col);
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#FFC7CE"); // light red
                    cell.Style.Font.FontColor       = XLColor.FromHtml("#9C0006"); // dark red
                    cell.Style.Font.Bold            = true;
                    cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                    cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#9C0006");
                }
            }

            // Step 2: Remove existing error sheet if it exists, then add fresh one
            if (wb.Worksheets.Any(w => w.Name == "Validation Errors"))
                wb.Worksheet("Validation Errors").Delete();

            var errSheet = wb.Worksheets.Add("Validation Errors");
            WriteErrorSheet(errSheet, failures, results.Count);

            wb.Save();
        }

        private static Dictionary<(DateTime date, string type), int> BuildRowIndex(IXLWorksheet ws)
        {
            var index = new Dictionary<(DateTime, string), int>();
            foreach (var row in ws.RowsUsed().Where(r => r.RowNumber() > 8))
            {
                var dateCell = row.Cell(1);
                if (dateCell.IsEmpty()) continue;
                DateTime date;
                try { date = dateCell.GetValue<DateTime>().Date; }
                catch { continue; }

                var advType = row.Cell(7).GetString().Trim();
                if (string.IsNullOrEmpty(advType)) continue;

                index.TryAdd((date, advType), row.RowNumber());
            }
            return index;
        }

        private static void WriteErrorSheet(
            IXLWorksheet ws,
            List<AccrualValidationResult> failures,
            int totalRows)
        {
            int r = 1;

            // ── Title ─────────────────────────────────────────────────────────
            ws.Cell(r, 1).Value = "Daily Accruals Validation — Error Report";
            ws.Cell(r, 1).Style.Font.Bold      = true;
            ws.Cell(r, 1).Style.Font.FontSize  = 16;
            ws.Cell(r, 1).Style.Font.FontColor = XLColor.FromHtml("#1F3864");
            ws.Range(r, 1, r, 7).Merge();
            r++;

            ws.Cell(r, 1).Value = $"Generated: {DateTime.Now:dd MMM yyyy HH:mm:ss}";
            ws.Cell(r, 1).Style.Font.Italic    = true;
            ws.Cell(r, 1).Style.Font.FontColor = XLColor.FromHtml("#808080");
            ws.Range(r, 1, r, 7).Merge();
            r += 2;

            // ── Summary box ───────────────────────────────────────────────────
            var normalRows  = failures.Where(f => f.AdvanceType != "[Cross-Row Constraint]").ToList();
            var passedCount = totalRows - failures.Count;
            var failedCount = failures.Count;
            var overall     = failedCount == 0 ? "PASS" : "FAIL";

            WriteSummaryRow(ws, r++, "Total Rows Validated", totalRows.ToString(),        "FFFFFF");
            WriteSummaryRow(ws, r++, "Passed (no errors)",   passedCount.ToString(),      "C6EFCE");
            WriteSummaryRow(ws, r++, "Failed (errors found)",failedCount.ToString(),       failedCount > 0 ? "FFC7CE" : "C6EFCE");
            WriteSummaryRow(ws, r++, "Overall Result",        overall,                    failedCount == 0 ? "C6EFCE" : "FFC7CE");
            r++;

            if (!failures.Any())
            {
                ws.Cell(r, 1).Value = "No errors found. All calculations are correct.";
                ws.Cell(r, 1).Style.Font.Bold = true;
                ws.Cell(r, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#C6EFCE");
                ws.Range(r, 1, r, 7).Merge();
                AutoFitColumns(ws);
                return;
            }

            // ── Error table header ────────────────────────────────────────────
            var headers = new[] { "Date", "Loan Type", "What Failed", "Plain English Meaning",
                                   "Calculated (Source)", "Validation File", "Difference" };
            for (int c = 0; c < headers.Length; c++)
            {
                var cell = ws.Cell(r, c + 1);
                cell.Value = headers[c];
                cell.Style.Font.Bold = true;
                cell.Style.Font.FontColor       = XLColor.White;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1F3864");
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#AAAAAA");
                cell.Style.Alignment.WrapText   = true;
            }
            r++;

            // ── Error rows ────────────────────────────────────────────────────
            bool shadeRow = false;
            foreach (var failure in normalRows)
            {
                var rowBg = shadeRow ? "F2F2F2" : "FFFFFF";

                foreach (var mismatch in failure.Mismatches)
                {
                    var field = mismatch.Split(':')[0].Trim();
                    var label = FieldLabels.TryGetValue(field, out var l) ? l : field;
                    var parts = mismatch.Split(new[] { ": expected=", ", actual=", ", diff=" }, StringSplitOptions.None);
                    var expStr  = parts.Length > 1 ? parts[1] : "?";
                    var actStr  = parts.Length > 2 ? parts[2] : "?";
                    var diffStr = parts.Length > 3 ? parts[3] : "?";

                    decimal exp = 0, act = 0;
                    decimal.TryParse(expStr, out exp);
                    decimal.TryParse(actStr, out act);

                    WriteRow(ws, r,
                        failure.AccrualDate.ToString("dd-MMM-yyyy"),
                        failure.AdvanceType,
                        field,
                        label,
                        FmtNum(exp),
                        FmtNum(act),
                        FmtNum(Math.Abs(exp - act)),
                        rowBg);
                    r++;
                }
                shadeRow = !shadeRow;
            }

            // Cross-row constraint rows
            foreach (var cf in failures.Where(f => f.AdvanceType == "[Cross-Row Constraint]"))
            {
                var parts = cf.Mismatches.First().Split(new[] { ": expected=", ", actual sum=", ", diff=" }, StringSplitOptions.None);
                decimal expS = 0, actS = 0;
                if (parts.Length > 1) decimal.TryParse(parts[1], out expS);
                if (parts.Length > 2) decimal.TryParse(parts[2], out actS);

                WriteRow(ws, r,
                    cf.AccrualDate.ToString("dd-MMM-yyyy"),
                    "IOA Split Check",
                    "IOA Excess Distribution",
                    "Sum of amounts distributed to NON-IOA types must equal IOA excess",
                    FmtNum(expS),
                    FmtNum(actS),
                    FmtNum(Math.Abs(expS - actS)),
                    "FFF2CC");
                r++;
            }

            // ── Freeze header and auto-fit ─────────────────────────────────────
            ws.SheetView.FreezeRows(7); // freeze above the data header
            AutoFitColumns(ws);
        }

        private static void WriteSummaryRow(IXLWorksheet ws, int r, string label, string value, string valueBg)
        {
            ws.Cell(r, 1).Value = label;
            ws.Cell(r, 1).Style.Font.Bold            = true;
            ws.Cell(r, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("D9E1F2");
            ws.Cell(r, 1).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            ws.Cell(r, 1).Style.Border.OutsideBorderColor = XLColor.FromHtml("AAAAAA");
            ws.Range(r, 1, r, 3).Merge();

            ws.Cell(r, 4).Value = value;
            ws.Cell(r, 4).Style.Font.Bold            = true;
            ws.Cell(r, 4).Style.Fill.BackgroundColor = XLColor.FromHtml(valueBg);
            ws.Cell(r, 4).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            ws.Cell(r, 4).Style.Border.OutsideBorderColor = XLColor.FromHtml("AAAAAA");
            ws.Range(r, 4, r, 7).Merge();
        }

        private static void WriteRow(IXLWorksheet ws, int r,
            string date, string type, string field, string meaning,
            string calc, string ideal, string diff, string bg)
        {
            var values = new[] { date, type, field, meaning, calc, ideal, diff };
            for (int c = 0; c < values.Length; c++)
            {
                var cell = ws.Cell(r, c + 1);
                cell.Value = values[c];
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml(bg);
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("CCCCCC");
                cell.Style.Alignment.WrapText   = true;

                // Colour the Validation File column red, Calculated green, Difference yellow
                if (c == 5) cell.Style.Fill.BackgroundColor = XLColor.FromHtml("FFC7CE");
                if (c == 4) cell.Style.Fill.BackgroundColor = XLColor.FromHtml("C6EFCE");
                if (c == 6) cell.Style.Fill.BackgroundColor = XLColor.FromHtml("FFEB9C");
            }
        }

        private static void AutoFitColumns(IXLWorksheet ws)
        {
            ws.Columns().AdjustToContents();
            // Cap wide columns
            for (int c = 1; c <= 7; c++)
            {
                var col = ws.Column(c);
                if (col.Width > 60) col.Width = 60;
            }
        }

        private static string FmtNum(decimal v) =>
            v == 0m ? "0" : (v >= 1000m || v <= -1000m ? $"{v:N6}" : $"{v:F6}");
    }
}

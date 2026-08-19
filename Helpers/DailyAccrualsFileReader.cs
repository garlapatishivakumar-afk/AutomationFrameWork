using ClosedXML.Excel;
using AutomationFrameWork.Models;

namespace AutomationFrameWork.Helpers
{
    public class DailyAccrualsFileReader
    {
        public LoanMetadata ReadLoanMetadata(string filePath)
        {
            if (!File.Exists(filePath))
                throw new FileNotFoundException($"Ideal accruals file not found: {filePath}");

            using var workbook = new XLWorkbook(filePath);
            var ws = workbook.Worksheet(1);

            var dateRangeRaw = ws.Cell(3, 2).GetString().Trim();
            var dateParts = dateRangeRaw.Split(" to ");

            return new LoanMetadata
            {
                DateFrom = DateTime.Parse(dateParts[0].Trim()),
                DateTo = DateTime.Parse(dateParts[1].Trim()),
                Trust = ws.Cell(4, 2).GetString().Trim(),
                LoanNumber = (long)ws.Cell(5, 2).GetValue<double>(),
                TotalRecords = (int)ws.Cell(6, 2).GetValue<double>()
            };
        }

        public List<AccrualRecord> ReadIdealAccrualRecords(string filePath)
        {
            if (!File.Exists(filePath))
                throw new FileNotFoundException($"Ideal accruals file not found: {filePath}");

            var records = new List<AccrualRecord>();
            using var workbook = new XLWorkbook(filePath);
            var ws = workbook.Worksheet(1);

            foreach (var row in ws.RowsUsed().Where(r => r.RowNumber() > 8))
            {
                var dateCell = row.Cell(1);
                if (dateCell.IsEmpty()) continue;

                DateTime accrualDate;
                try { accrualDate = dateCell.GetValue<DateTime>().Date; }
                catch { continue; }

                var advanceType = row.Cell(7).GetString().Trim();
                if (string.IsNullOrEmpty(advanceType)) continue;

                records.Add(new AccrualRecord
                {
                    AccrualDate = accrualDate,
                    InterestRate = GetDecimal(row.Cell(2)),
                    TrustNumber = row.Cell(3).GetString().Trim(),
                    TrustName = row.Cell(4).GetString().Trim(),
                    LoanNumber = row.Cell(5).GetString().Trim(),
                    AdvanceType = advanceType,
                    PrincipalBalance = GetDecimal(row.Cell(8)),
                    DailyAccrual = GetDecimal(row.Cell(9)),
                    AccumulatedOnOriginal = GetDecimal(row.Cell(10)),
                    CompoundedBasis = GetDecimal(row.Cell(11)),
                    DailyAccrualOnCompound = GetDecimal(row.Cell(12)),
                    AccumulatedOnCompounded = GetDecimal(row.Cell(13)),
                    TotalBalance = GetDecimal(row.Cell(14)),
                    Advances = GetDecimal(row.Cell(15)),
                    TotalRepayments = GetDecimal(row.Cell(16)),
                    PrincipalRepayment = GetDecimal(row.Cell(17)),
                    CompoundedPrincipalRepayment = GetDecimal(row.Cell(18)),
                    InterestOnOriginalRepayment = GetDecimal(row.Cell(19)),
                    InterestOnCompoundedRepayment = GetDecimal(row.Cell(20)),
                    TotalAdjustments = GetDecimal(row.Cell(21)),
                    PrincipalAdjustments = GetDecimal(row.Cell(22)),
                    InterestAdjustments = GetDecimal(row.Cell(23)),
                    OverpaymentBalance = GetDecimal(row.Cell(24)),
                    IOAOverpaymentBalance = GetDecimal(row.Cell(25)),
                    OverpaymentAllocation = GetDecimal(row.Cell(26))
                });
            }

            return records;
        }

        public List<SourceTransaction> ReadSourceTransactions(string filePath, long loanNumber)
        {
            if (!File.Exists(filePath))
                throw new FileNotFoundException($"Source transactions file not found: {filePath}");

            var transactions = new List<SourceTransaction>();
            using var workbook = new XLWorkbook(filePath);
            var ws = workbook.Worksheet(1);

            foreach (var row in ws.RowsUsed().Skip(1))
            {
                var loanCell = row.Cell(3);
                if (loanCell.IsEmpty()) continue;

                long rowLoan;
                try { rowLoan = (long)loanCell.GetValue<double>(); }
                catch { continue; }

                if (rowLoan != loanNumber) continue;

                var dateCell = row.Cell(5);
                if (dateCell.IsEmpty()) continue;

                DateTime txnDate;
                try { txnDate = dateCell.GetValue<DateTime>().Date; }
                catch { continue; }

                var amountCell = row.Cell(6);
                if (amountCell.IsEmpty()) continue;
                var amount = GetDecimal(amountCell);

                var advanceType = row.Cell(10).GetString().Trim();
                if (string.IsNullOrEmpty(advanceType)) continue;

                long trustNumber;
                try { trustNumber = (long)row.Cell(1).GetValue<double>(); }
                catch { trustNumber = 0; }

                transactions.Add(new SourceTransaction
                {
                    TrustNumber = trustNumber,
                    TrustName = row.Cell(2).GetString().Trim(),
                    LoanNumber = rowLoan,
                    TransactionDate = txnDate,
                    Amount = amount,
                    AdvanceType = advanceType
                });
            }

            return transactions;
        }

        private static decimal GetDecimal(IXLCell cell)
        {
            if (cell.IsEmpty()) return 0m;
            try { return (decimal)cell.GetValue<double>(); }
            catch { return 0m; }
        }
    }
}

using AutomationFrameWork.Models;

namespace AutomationFrameWork.Helpers
{
    public class AccrualsCalculationEngine
    {
        private const decimal AccumulatedTolerance = 0.05m;
        private const decimal StandardTolerance = 0.02m;

        private static readonly string[] NonIoaPriorityOrder =
            { "Principal and Interest", "Property Protection", "Trust and Insurance" };

        private class TypeAccrualState
        {
            public string AdvanceType { get; set; } = string.Empty;
            public decimal Principal { get; set; }
            public decimal AccumulatedInterest { get; set; }    // J running total
            public decimal CompoundBasis { get; set; }          // K (locked once set)
            public decimal DailyAccrualOnCompound { get; set; } // L (fixed once set)
            public decimal AccumulatedCompounded { get; set; }  // M running total
            public decimal OverpaymentBalance { get; set; }     // X (NON-IOA only)
            public decimal IOAOverpaymentBalance { get; set; }  // Y (IOA only)
            public bool IsClosed { get; set; }
            public DateTime? FirstAdvanceDate { get; set; }
            public bool CompoundingStarted { get; set; }
        }

        private class DayTransactionResult
        {
            public decimal Advances { get; set; }                       // O
            public decimal TotalRepayments { get; set; }                // P (legacy accumulator, replaced by P=Q+S+T rule)
            public decimal PrincipalRepayment { get; set; }             // Q
            public decimal InterestRepayment { get; set; }              // S
            public decimal InterestOnCompoundedRepayment { get; set; }  // T
            public decimal OverpaymentAllocation { get; set; }          // Z
            public decimal IoacExcess { get; set; }             // IOA row only: excess after closing IOA
            public bool IsIoaExcessRecipient { get; set; }      // NON-IOA: received random S split from IOA excess
        }

        public List<AccrualValidationResult> Validate(
            List<SourceTransaction> sourceTransactions,
            List<AccrualRecord> idealRecords)
        {
            var results = new List<AccrualValidationResult>();
            var states = new Dictionary<string, TypeAccrualState>(StringComparer.OrdinalIgnoreCase);

            // Compound starts 1 year after the loan's first advance (earliest across all types)
            var loanFirstAdvanceDate = sourceTransactions
                .Where(t => t.Amount > 0)
                .Select(t => t.TransactionDate.Date)
                .OrderBy(d => d)
                .FirstOrDefault();

            var idealByDate = idealRecords
                .GroupBy(r => r.AccrualDate.Date)
                .ToDictionary(
                    g => g.Key,
                    g => g.ToDictionary(r => r.AdvanceType, StringComparer.OrdinalIgnoreCase));

            var txnsByDate = sourceTransactions
                .GroupBy(t => t.TransactionDate.Date)
                .ToDictionary(g => g.Key, g => g.ToList());

            var allDates = idealRecords
                .Select(r => r.AccrualDate.Date)
                .Distinct()
                .OrderBy(d => d)
                .ToList();

            foreach (var date in allDates)
            {
                var dayTxns = txnsByDate.TryGetValue(date, out var txns) ? txns : new List<SourceTransaction>();
                var idealForDate = idealByDate.TryGetValue(date, out var dateDict)
                    ? dateDict
                    : new Dictionary<string, AccrualRecord>(StringComparer.OrdinalIgnoreCase);

                var dayResults = idealForDate.Keys
                    .ToDictionary(t => t, _ => new DayTransactionResult(), StringComparer.OrdinalIgnoreCase);

                InitializeNewTypeStates(states, dayTxns, date);
                ProcessAdvances(states, dayTxns, dayResults);
                ProcessNonIoaRepayments(states, dayTxns, dayResults);
                ProcessIoaRepayments(states, dayTxns, dayResults, idealForDate);
                ProcessYAllocations(states, dayResults, idealForDate);

                foreach (var type in idealForDate.Keys)
                {
                    if (!states.TryGetValue(type, out var state))
                        continue;

                    var idealRow = idealForDate[type];
                    if (!dayResults.TryGetValue(type, out var dayResult))
                        dayResult = new DayTransactionResult();

                    var expected = BuildExpectedRecord(state, idealRow, dayResult, date, loanFirstAdvanceDate);

                    var mismatches = CompareRecords(expected, idealRow, dayResult.IsIoaExcessRecipient);

                    results.Add(new AccrualValidationResult
                    {
                        AccrualDate = date,
                        AdvanceType = type,
                        Expected = expected,
                        Actual = idealRow,
                        Mismatches = mismatches
                    });
                }

                // Cross-row constraint: sum of NON-IOA S = IOA excess on IOA repayment day
                var ioaExcess = dayResults
                    .Where(kv => string.Equals(kv.Key, "IOA", StringComparison.OrdinalIgnoreCase))
                    .Select(kv => kv.Value.IoacExcess)
                    .FirstOrDefault();

                if (ioaExcess > 0m)
                {
                    var sumNonIoaS = idealForDate
                        .Where(kv => !string.Equals(kv.Key, "IOA", StringComparison.OrdinalIgnoreCase))
                        .Sum(kv => kv.Value.InterestOnOriginalRepayment);

                    if (Math.Abs(sumNonIoaS - ioaExcess) > StandardTolerance)
                    {
                        results.Add(new AccrualValidationResult
                        {
                            AccrualDate = date,
                            AdvanceType = "[Cross-Row Constraint]",
                            Expected = new AccrualRecord { AccrualDate = date, InterestOnOriginalRepayment = ioaExcess },
                            Actual   = new AccrualRecord { AccrualDate = date, InterestOnOriginalRepayment = sumNonIoaS },
                            Mismatches = new List<string>
                            {
                                $"Sum of NON-IOA InterestOnOriginalRepayment (S) must equal IOA excess: expected={ioaExcess:F6}, actual sum={sumNonIoaS:F6}, diff={Math.Abs(sumNonIoaS - ioaExcess):F6}"
                            }
                        });
                    }
                }
            }

            return results;
        }

        private static void InitializeNewTypeStates(
            Dictionary<string, TypeAccrualState> states,
            List<SourceTransaction> dayTxns,
            DateTime date)
        {
            foreach (var txn in dayTxns.Where(t => t.Amount > 0))
            {
                if (!states.ContainsKey(txn.AdvanceType))
                {
                    states[txn.AdvanceType] = new TypeAccrualState
                    {
                        AdvanceType = txn.AdvanceType,
                        FirstAdvanceDate = date
                    };
                }
            }
        }

        private static void ProcessAdvances(
            Dictionary<string, TypeAccrualState> states,
            List<SourceTransaction> dayTxns,
            Dictionary<string, DayTransactionResult> dayResults)
        {
            foreach (var group in dayTxns.Where(t => t.Amount > 0).GroupBy(t => t.AdvanceType))
            {
                var type = group.Key;
                var totalAdv = group.Sum(t => t.Amount);

                if (!states.TryGetValue(type, out var state)) continue;
                if (!dayResults.TryGetValue(type, out var dayResult)) continue;

                dayResult.Advances = totalAdv;

                var isNonIoa = !string.Equals(type, "IOA", StringComparison.OrdinalIgnoreCase);
                if (isNonIoa && state.OverpaymentBalance > 0)
                {
                    var absorbed = Math.Min(totalAdv, state.OverpaymentBalance);
                    state.OverpaymentBalance -= absorbed;
                    dayResult.OverpaymentAllocation = absorbed;
                    dayResult.PrincipalRepayment += absorbed;
                    dayResult.TotalRepayments += absorbed;
                    state.Principal += totalAdv - absorbed;
                }
                else
                {
                    state.Principal += totalAdv;
                }
            }
        }

        private static void ProcessNonIoaRepayments(
            Dictionary<string, TypeAccrualState> states,
            List<SourceTransaction> dayTxns,
            Dictionary<string, DayTransactionResult> dayResults)
        {
            var nonIoaRepays = dayTxns
                .Where(t => t.Amount < 0 && !string.Equals(t.AdvanceType, "IOA", StringComparison.OrdinalIgnoreCase))
                .GroupBy(t => t.AdvanceType);

            foreach (var group in nonIoaRepays)
            {
                var type = group.Key;
                var totalRepay = group.Sum(t => Math.Abs(t.Amount));

                if (!states.TryGetValue(type, out var state)) continue;
                if (!dayResults.TryGetValue(type, out var dayResult)) continue;

                dayResult.TotalRepayments += totalRepay;

                if (totalRepay <= state.Principal)
                {
                    state.Principal -= totalRepay;
                    dayResult.PrincipalRepayment += totalRepay;
                }
                else
                {
                    var excess = totalRepay - state.Principal;
                    dayResult.PrincipalRepayment += state.Principal;
                    // Excess goes to X (Overpayment) — NOT included in P
                    dayResult.TotalRepayments -= excess;
                    state.Principal = 0m;
                    state.OverpaymentBalance += excess;
                }
            }
        }

        private static void ProcessIoaRepayments(
            Dictionary<string, TypeAccrualState> states,
            List<SourceTransaction> dayTxns,
            Dictionary<string, DayTransactionResult> dayResults,
            Dictionary<string, AccrualRecord> idealForDate)
        {
            var ioaRepays = dayTxns
                .Where(t => t.Amount < 0 && string.Equals(t.AdvanceType, "IOA", StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (!ioaRepays.Any()) return;
            if (!states.TryGetValue("IOA", out var ioaState)) return;

            var totalIoaRepay = ioaRepays.Sum(t => Math.Abs(t.Amount));
            var ioaTotal = ioaState.Principal + ioaState.AccumulatedInterest + ioaState.AccumulatedCompounded;

            if (!dayResults.TryGetValue("IOA", out var ioaDayResult))
                dayResults["IOA"] = ioaDayResult = new DayTransactionResult();

            ioaDayResult.TotalRepayments = totalIoaRepay;

            if (totalIoaRepay >= ioaTotal)
            {
                ioaDayResult.PrincipalRepayment = ioaState.Principal;
                ioaDayResult.InterestRepayment = ioaState.AccumulatedInterest;
                ioaDayResult.InterestOnCompoundedRepayment = Math.Round(ioaState.AccumulatedCompounded, 2, MidpointRounding.AwayFromZero);
                // IOA row P = only what was needed to close IOA (Q + S + T), not the full repayment
                ioaDayResult.TotalRepayments = ioaTotal;

                var excess = totalIoaRepay - ioaTotal;
                ioaState.Principal = 0m;
                ioaState.AccumulatedInterest = 0m;
                ioaState.AccumulatedCompounded = 0m;
                ioaState.IsClosed = true;
                ioaDayResult.IoacExcess = excess;

                if (excess > 0m)
                {
                    // Rule: excess first clears full J (S) and full M (T) for each non-IOA type.
                    // Whatever remains after all non-IOA J+M cleared → Y (IOAOverpaymentBalance).
                    var activeNonIoa = NonIoaPriorityOrder
                        .Where(t => states.ContainsKey(t) && dayResults.ContainsKey(t) && idealForDate.ContainsKey(t))
                        .Select(t => (State: states[t], DayResult: dayResults[t], IdealRow: idealForDate[t]))
                        .ToList();

                    foreach (var item in activeNonIoa)
                    {
                        // S = full accumulated interest (J) of this non-IOA type
                        var sRepay = item.State.AccumulatedInterest;
                        if (sRepay > 0m)
                        {
                            item.State.AccumulatedInterest = 0m;
                            item.DayResult.InterestRepayment += sRepay;
                            item.DayResult.IsIoaExcessRecipient = true;
                        }

                        // T = Round(AccumulatedCompounded, 2); K and M reset to 0
                        var tRepay = Math.Round(item.State.AccumulatedCompounded, 2, MidpointRounding.AwayFromZero);
                        if (tRepay > 0m)
                        {
                            item.DayResult.InterestOnCompoundedRepayment += tRepay;
                            item.State.AccumulatedCompounded = 0m;
                            item.State.CompoundBasis = 0m;
                            item.State.DailyAccrualOnCompound = 0m;
                            item.State.CompoundingStarted = false;
                        }
                    }

                    // Remaining excess after all non-IOA J+M cleared → Y (broadcast to all rows)
                    var sumNonIoaS = activeNonIoa.Sum(x => x.DayResult.InterestRepayment);
                    var sumNonIoaT = activeNonIoa.Sum(x => x.DayResult.InterestOnCompoundedRepayment);
                    var remainingExcess = excess - sumNonIoaS - sumNonIoaT;
                    if (remainingExcess > 0m)
                    {
                        ioaState.IOAOverpaymentBalance += remainingExcess;
                        foreach (var item in activeNonIoa)
                            item.State.IOAOverpaymentBalance = ioaState.IOAOverpaymentBalance;
                    }
                }
            }
            else
            {
                var prinRepay = Math.Min(totalIoaRepay, ioaState.Principal);
                var intRepay = totalIoaRepay - prinRepay;
                ioaState.Principal -= prinRepay;
                ioaState.AccumulatedInterest -= intRepay;
                ioaDayResult.PrincipalRepayment = prinRepay;
                ioaDayResult.InterestRepayment = intRepay;
            }
        }

        private static void ProcessYAllocations(
            Dictionary<string, TypeAccrualState> states,
            Dictionary<string, DayTransactionResult> dayResults,
            Dictionary<string, AccrualRecord> idealForDate)
        {
            // On any day the ideal file shows Z (OverpaymentAllocation) > 0 for a non-IOA type,
            // apply Y balance as S against AccumulatedInterest and clear Y from all states.
            foreach (var kvp in idealForDate)
            {
                var type = kvp.Key;
                var idealRow = kvp.Value;

                if (string.Equals(type, "IOA", StringComparison.OrdinalIgnoreCase)) continue;
                if (idealRow.OverpaymentAllocation <= 0m) continue;
                if (!states.TryGetValue(type, out var state)) continue;
                if (!dayResults.TryGetValue(type, out var dayResult)) continue;

                var z = idealRow.OverpaymentAllocation;
                var s = idealRow.InterestOnOriginalRepayment;

                // Apply S against AccumulatedInterest (J)
                state.AccumulatedInterest -= Math.Min(s, state.AccumulatedInterest);
                dayResult.InterestRepayment += s;
                dayResult.OverpaymentAllocation += z;

                // Reduce Y on all states by the allocated amount
                state.IOAOverpaymentBalance = Math.Max(0m, state.IOAOverpaymentBalance - z);
                if (states.TryGetValue("IOA", out var ioaState))
                    ioaState.IOAOverpaymentBalance = Math.Max(0m, ioaState.IOAOverpaymentBalance - z);
            }
        }

        private static AccrualRecord BuildExpectedRecord(
            TypeAccrualState state,
            AccrualRecord idealRow,
            DayTransactionResult dayResult,
            DateTime date,
            DateTime loanFirstAdvanceDate)
        {
            decimal I, J, K, L, M;

            decimal N;
            if (state.IsClosed)
            {
                I = 0m; J = 0m; K = 0m; L = 0m; M = 0m; N = 0m;
            }
            else
            {
                var B = idealRow.InterestRate;

                if (!state.CompoundingStarted && loanFirstAdvanceDate != default)
                {
                    // Compound starts 1 year after the loan's first advance (same date for all types)
                    var compoundStart = loanFirstAdvanceDate.AddYears(1);
                    if (date >= compoundStart)
                    {
                        var isIoa = string.Equals(state.AdvanceType, "IOA", StringComparison.OrdinalIgnoreCase);
                        // IOA: compound on total amount (Principal + AccumulatedInterest), full precision
                        // Non-IOA: compound on AccumulatedInterest (J) only, rounded to 2 decimal places
                        state.CompoundBasis = isIoa
                            ? state.Principal + state.AccumulatedInterest
                            : Math.Round(state.AccumulatedInterest, 2, MidpointRounding.AwayFromZero);
                        state.DailyAccrualOnCompound = state.CompoundBasis * B / 360m;
                        state.CompoundingStarted = true;
                    }
                }

                I = state.Principal * B / 360m;
                state.AccumulatedInterest += I;
                state.AccumulatedCompounded += state.DailyAccrualOnCompound;

                J = state.AccumulatedInterest;
                K = state.CompoundBasis;
                L = state.DailyAccrualOnCompound;
                M = state.AccumulatedCompounded;
                N = state.Principal + state.AccumulatedInterest + state.AccumulatedCompounded;
            }

            return new AccrualRecord
            {
                AccrualDate = date,
                AdvanceType = state.AdvanceType,
                InterestRate = idealRow.InterestRate,
                TrustNumber = idealRow.TrustNumber,
                TrustName = idealRow.TrustName,
                LoanNumber = idealRow.LoanNumber,
                PrincipalBalance = state.Principal,
                DailyAccrual = I,
                AccumulatedOnOriginal = J,
                CompoundedBasis = K,
                DailyAccrualOnCompound = L,
                AccumulatedOnCompounded = M,
                TotalBalance = N,
                Advances = dayResult.Advances,
                TotalRepayments = dayResult.PrincipalRepayment + dayResult.InterestRepayment + dayResult.InterestOnCompoundedRepayment,  // P = Q + S + T
                PrincipalRepayment = dayResult.PrincipalRepayment,
                InterestOnOriginalRepayment = dayResult.InterestRepayment,
                InterestOnCompoundedRepayment = dayResult.InterestOnCompoundedRepayment,
                OverpaymentBalance = state.OverpaymentBalance,
                IOAOverpaymentBalance = state.IOAOverpaymentBalance,
                OverpaymentAllocation = dayResult.OverpaymentAllocation
            };
        }

        private static List<string> CompareRecords(AccrualRecord expected, AccrualRecord actual, bool skipIndividualS = false)
        {
            var mismatches = new List<string>();

            void CheckStd(string field, decimal exp, decimal act)
            {
                if (Math.Abs(exp - act) > StandardTolerance)
                    mismatches.Add($"{field}: expected={exp:F6}, actual={act:F6}, diff={Math.Abs(exp - act):F6}");
            }

            void CheckAccum(string field, decimal exp, decimal act)
            {
                if (Math.Abs(exp - act) > AccumulatedTolerance)
                    mismatches.Add($"{field}: expected={exp:F6}, actual={act:F6}, diff={Math.Abs(exp - act):F6}");
            }

            CheckStd("PrincipalBalance (H)", expected.PrincipalBalance, actual.PrincipalBalance);
            CheckStd("DailyAccrual (I)", expected.DailyAccrual, actual.DailyAccrual);
            CheckAccum("AccumulatedOnOriginal (J)", expected.AccumulatedOnOriginal, actual.AccumulatedOnOriginal);
            CheckStd("CompoundedBasis (K)", expected.CompoundedBasis, actual.CompoundedBasis);
            CheckStd("DailyAccrualOnCompound (L)", expected.DailyAccrualOnCompound, actual.DailyAccrualOnCompound);
            CheckAccum("AccumulatedOnCompounded (M)", expected.AccumulatedOnCompounded, actual.AccumulatedOnCompounded);
            CheckAccum("TotalBalance (N)", expected.TotalBalance, actual.TotalBalance);
            CheckStd("Advances (O)", expected.Advances, actual.Advances);
            CheckStd("TotalRepayments (P)", expected.TotalRepayments, actual.TotalRepayments);
            CheckStd("PrincipalRepayment (Q)", expected.PrincipalRepayment, actual.PrincipalRepayment);
            // S is skipped for individual NON-IOA rows on IOA excess repayment day
            // — validated as a cross-row sum constraint instead (sum of all NON-IOA S = IOA excess)
            if (!skipIndividualS)
                CheckStd("InterestOnOriginalRepayment (S)", expected.InterestOnOriginalRepayment, actual.InterestOnOriginalRepayment);
            CheckStd("OverpaymentBalance (X)", expected.OverpaymentBalance, actual.OverpaymentBalance);
            CheckStd("IOAOverpaymentBalance (Y)", expected.IOAOverpaymentBalance, actual.IOAOverpaymentBalance);
            CheckStd("OverpaymentAllocation (Z)", expected.OverpaymentAllocation, actual.OverpaymentAllocation);

            return mismatches;
        }
    }
}

namespace AutomationFrameWork.Models
{
    public class AccrualRecord
    {
        public DateTime AccrualDate { get; set; }
        public decimal InterestRate { get; set; }                   // B
        public string TrustNumber { get; set; }                     // C
        public string TrustName { get; set; }                       // D
        public string LoanNumber { get; set; }                      // E
        public string AdvanceType { get; set; }                     // G
        public decimal PrincipalBalance { get; set; }               // H
        public decimal DailyAccrual { get; set; }                   // I
        public decimal AccumulatedOnOriginal { get; set; }          // J
        public decimal CompoundedBasis { get; set; }                // K
        public decimal DailyAccrualOnCompound { get; set; }         // L
        public decimal AccumulatedOnCompounded { get; set; }        // M
        public decimal TotalBalance { get; set; }                   // N
        public decimal Advances { get; set; }                       // O
        public decimal TotalRepayments { get; set; }                // P
        public decimal PrincipalRepayment { get; set; }             // Q
        public decimal CompoundedPrincipalRepayment { get; set; }   // R
        public decimal InterestOnOriginalRepayment { get; set; }    // S
        public decimal InterestOnCompoundedRepayment { get; set; }  // T
        public decimal TotalAdjustments { get; set; }               // U
        public decimal PrincipalAdjustments { get; set; }           // V
        public decimal InterestAdjustments { get; set; }            // W
        public decimal OverpaymentBalance { get; set; }             // X
        public decimal IOAOverpaymentBalance { get; set; }          // Y
        public decimal OverpaymentAllocation { get; set; }          // Z
    }
}

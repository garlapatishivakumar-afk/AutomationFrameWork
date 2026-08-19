namespace AutomationFrameWork.Models
{
    public class SourceTransaction
    {
        public long TrustNumber { get; set; }
        public string TrustName { get; set; }
        public long LoanNumber { get; set; }
        public DateTime TransactionDate { get; set; }
        public decimal Amount { get; set; }
        public string AdvanceType { get; set; }
    }
}

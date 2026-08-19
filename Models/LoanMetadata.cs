namespace AutomationFrameWork.Models
{
    public class LoanMetadata
    {
        public DateTime DateFrom { get; set; }
        public DateTime DateTo { get; set; }
        public string Trust { get; set; }
        public long LoanNumber { get; set; }
        public int TotalRecords { get; set; }
    }
}

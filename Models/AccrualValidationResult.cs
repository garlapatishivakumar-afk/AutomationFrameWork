namespace AutomationFrameWork.Models
{
    public class AccrualValidationResult
    {
        public DateTime AccrualDate { get; set; }
        public string AdvanceType { get; set; }
        public AccrualRecord Expected { get; set; }
        public AccrualRecord Actual { get; set; }
        public List<string> Mismatches { get; set; } = new();
        public bool IsValid => !Mismatches.Any();
    }
}

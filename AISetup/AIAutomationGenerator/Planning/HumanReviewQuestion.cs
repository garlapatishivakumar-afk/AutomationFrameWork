using System;
using System.Collections.Generic;

namespace AIAutomationGenerator.Planning
{
    public class HumanReviewQuestion
    {
        public string QuestionId { get; set; } = Guid.NewGuid().ToString("N");
        public string RunId { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public string Question { get; set; } = string.Empty;
        public List<string> Options { get; set; } = new();
        public List<string> Evidence { get; set; } = new();
        public string? RecommendedOption { get; set; }
        public string Risk { get; set; } = "Medium";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string? Answer { get; set; }
    }
}
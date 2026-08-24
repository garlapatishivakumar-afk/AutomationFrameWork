using System;
using System.Collections.Generic;

namespace AIAutomationGenerator.Intelligence.Models
{
    public class RepositorySnapshot
    {
        public string RunId { get; set; } = string.Empty;
        public string RepositoryRoot { get; set; } = string.Empty;
        public string? RepositoryHead { get; set; }
        public int FileCount { get; set; }
        public List<RepositorySnapshotFile> Files { get; set; } = new();
        public string SnapshotHash { get; set; } = string.Empty;
        public DateTime SnapshotAtUtc { get; set; }
    }

    public class RepositorySnapshotFile
    {
        public string RelativePath { get; set; } = string.Empty;
        public string? Sha256 { get; set; }
        public long Length { get; set; }
    }
}
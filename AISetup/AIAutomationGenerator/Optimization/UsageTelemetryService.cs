using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;

namespace AIAutomationGenerator.Optimization;

public sealed class UsageTelemetryService
{
    private static readonly AsyncLocal<UsageTelemetryService?> CurrentScope = new();

    private readonly DateTime _startedAt = DateTime.UtcNow;
    private readonly ConcurrentDictionary<string, long> _stageDurationMs = new(StringComparer.OrdinalIgnoreCase);

    private long _repositoryFilesScanned;
    private long _repositoryFilesRead;
    private long _parserInvocations;
    private long _cacheHits;
    private long _cacheMisses;
    private long _retrievalCandidates;
    private long _aiCalls;
    private long _promptTokens;
    private long _completionTokens;
    private long _totalTokens;
    private long _generatedFiles;
    private long _reusedFiles;
    private long _extendedFiles;
    private long _humanReviewCount;
    private long _selfHealAttempts;
    private long _buildDurationMs;
    private long _testDurationMs;

    public static UsageTelemetryService? Current => CurrentScope.Value;

    public static IDisposable BeginScope(UsageTelemetryService telemetry)
    {
        var previous = CurrentScope.Value;
        CurrentScope.Value = telemetry;
        return new ScopeReset(previous);
    }

    public void IncrementRepositoryFilesScanned(long count = 1) => Interlocked.Add(ref _repositoryFilesScanned, count);
    public void IncrementRepositoryFilesRead(long count = 1) => Interlocked.Add(ref _repositoryFilesRead, count);
    public void IncrementParserInvocations(long count = 1) => Interlocked.Add(ref _parserInvocations, count);
    public void IncrementCacheHits(long count = 1) => Interlocked.Add(ref _cacheHits, count);
    public void IncrementCacheMisses(long count = 1) => Interlocked.Add(ref _cacheMisses, count);
    public void IncrementRetrievalCandidates(long count = 1) => Interlocked.Add(ref _retrievalCandidates, count);
    public void IncrementAiCalls(long count = 1) => Interlocked.Add(ref _aiCalls, count);
    public void IncrementGeneratedFiles(long count = 1) => Interlocked.Add(ref _generatedFiles, count);
    public void IncrementReusedFiles(long count = 1) => Interlocked.Add(ref _reusedFiles, count);
    public void IncrementExtendedFiles(long count = 1) => Interlocked.Add(ref _extendedFiles, count);
    public void IncrementHumanReviewCount(long count = 1) => Interlocked.Add(ref _humanReviewCount, count);
    public void IncrementSelfHealAttempts(long count = 1) => Interlocked.Add(ref _selfHealAttempts, count);

    public void RecordStageDuration(string stageName, long durationMs)
    {
        _stageDurationMs[stageName] = durationMs;
    }

    public void RecordBuildDuration(long durationMs) => Interlocked.Exchange(ref _buildDurationMs, durationMs);
    public void RecordTestDuration(long durationMs) => Interlocked.Exchange(ref _testDurationMs, durationMs);

    public void RecordTokenUsage(long promptTokens, long completionTokens, long totalTokens)
    {
        Interlocked.Exchange(ref _promptTokens, promptTokens);
        Interlocked.Exchange(ref _completionTokens, completionTokens);
        Interlocked.Exchange(ref _totalTokens, totalTokens);
    }

    public UsageTelemetrySnapshot Snapshot(string aiCredits = "NOT_AVAILABLE", string estimatedCost = "NOT_AVAILABLE")
    {
        return new UsageTelemetrySnapshot
        {
            TotalExecutionTimeMs = (long)(DateTime.UtcNow - _startedAt).TotalMilliseconds,
            StageExecutionTimeMs = new Dictionary<string, long>(_stageDurationMs, StringComparer.OrdinalIgnoreCase),
            RepositoryFilesScanned = Interlocked.Read(ref _repositoryFilesScanned),
            RepositoryFilesRead = Interlocked.Read(ref _repositoryFilesRead),
            ParserInvocations = Interlocked.Read(ref _parserInvocations),
            CacheHits = Interlocked.Read(ref _cacheHits),
            CacheMisses = Interlocked.Read(ref _cacheMisses),
            RetrievalCandidates = Interlocked.Read(ref _retrievalCandidates),
            AiCalls = Interlocked.Read(ref _aiCalls),
            PromptTokens = Interlocked.Read(ref _promptTokens),
            CompletionTokens = Interlocked.Read(ref _completionTokens),
            TotalTokens = Interlocked.Read(ref _totalTokens),
            AiCredits = aiCredits,
            EstimatedCost = estimatedCost,
            GeneratedFiles = Interlocked.Read(ref _generatedFiles),
            ReusedFiles = Interlocked.Read(ref _reusedFiles),
            ExtendedFiles = Interlocked.Read(ref _extendedFiles),
            HumanReviewCount = Interlocked.Read(ref _humanReviewCount),
            BuildDurationMs = Interlocked.Read(ref _buildDurationMs),
            TestDurationMs = Interlocked.Read(ref _testDurationMs),
            SelfHealAttempts = Interlocked.Read(ref _selfHealAttempts)
        };
    }

    private sealed class ScopeReset : IDisposable
    {
        private readonly UsageTelemetryService? _previous;
        public ScopeReset(UsageTelemetryService? previous) => _previous = previous;
        public void Dispose() => CurrentScope.Value = _previous;
    }
}

public sealed class UsageTelemetrySnapshot
{
    public long TotalExecutionTimeMs { get; set; }
    public Dictionary<string, long> StageExecutionTimeMs { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public long RepositoryFilesScanned { get; set; }
    public long RepositoryFilesRead { get; set; }
    public long ParserInvocations { get; set; }
    public long CacheHits { get; set; }
    public long CacheMisses { get; set; }
    public long RetrievalCandidates { get; set; }
    public long AiCalls { get; set; }
    public long PromptTokens { get; set; }
    public long CompletionTokens { get; set; }
    public long TotalTokens { get; set; }
    public string AiCredits { get; set; } = "NOT_AVAILABLE";
    public string EstimatedCost { get; set; } = "NOT_AVAILABLE";
    public long GeneratedFiles { get; set; }
    public long ReusedFiles { get; set; }
    public long ExtendedFiles { get; set; }
    public long HumanReviewCount { get; set; }
    public long BuildDurationMs { get; set; }
    public long TestDurationMs { get; set; }
    public long SelfHealAttempts { get; set; }
}
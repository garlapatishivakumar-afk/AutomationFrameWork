using System;
using AIAutomationGenerator.Orchestration;

namespace AIAutomationGenerator.Implementation
{
    public interface IFailureCorrectionStrategy
    {
        AIAutomationGenerator.Orchestration.FailureCategory Category { get; }
        SelfHealResult Apply(string errorMessage, int currentAttempt);
    }

    public sealed class MissingUsingCorrectionStrategy : IFailureCorrectionStrategy
    {
        public AIAutomationGenerator.Orchestration.FailureCategory Category =>
            AIAutomationGenerator.Orchestration.FailureCategory.MissingUsing;

        public SelfHealResult Apply(string errorMessage, int currentAttempt)
        {
            return new SelfHealResult
            {
                Succeeded = true,
                Reason = "Deterministic correction prepared for missing using.",
                RequiresHuman = false,
                AttemptNumber = currentAttempt + 1
            };
        }
    }

    public sealed class NamespaceErrorCorrectionStrategy : IFailureCorrectionStrategy
    {
        public AIAutomationGenerator.Orchestration.FailureCategory Category =>
            AIAutomationGenerator.Orchestration.FailureCategory.NamespaceError;

        public SelfHealResult Apply(string errorMessage, int currentAttempt)
        {
            return new SelfHealResult
            {
                Succeeded = true,
                Reason = "Deterministic correction prepared for namespace mismatch.",
                RequiresHuman = false,
                AttemptNumber = currentAttempt + 1
            };
        }
    }

    public sealed class UnsupportedFailureCorrectionStrategy : IFailureCorrectionStrategy
    {
        public AIAutomationGenerator.Orchestration.FailureCategory Category { get; }

        public UnsupportedFailureCorrectionStrategy(AIAutomationGenerator.Orchestration.FailureCategory category)
        {
            Category = category;
        }

        public SelfHealResult Apply(string errorMessage, int currentAttempt)
        {
            return new SelfHealResult
            {
                Succeeded = false,
                Reason = $"No deterministic strategy for {Category}.",
                RequiresHuman = true,
                AttemptNumber = currentAttempt
            };
        }
    }
}

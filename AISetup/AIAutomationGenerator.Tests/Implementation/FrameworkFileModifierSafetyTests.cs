using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using AIAutomationGenerator.Implementation;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Safety;
using Xunit;

namespace AIAutomationGenerator.Tests.Implementation
{
    public class FrameworkFileModifierSafetyTests
    {
        [Fact]
        public async Task Modifier_CannotBypassProtectedFilePolicy()
        {
            var validator = new TestArchitectureValidator();
            var logger = new TestLogger();
            var policy = new ProtectedFilePolicy();
            var modifier = new FrameworkFileModifier(validator, logger, policy);

            var change = new ImplementationChange
            {
                Action = "EXTEND",
                FilePath = "Hooks/Hooks.cs",
                GeneratedContent = "public void Unsafe() {}",
                ValidationRequired = false,
                MemberName = "Unsafe"
            };

            var result = await modifier.ApplyAsync(change, Directory.GetCurrentDirectory());
            Assert.False(result);
        }

        private sealed class TestArchitectureValidator : IArchitectureValidator
        {
            public ArchitectureValidationResult Validate(ImplementationChange change, string frameworkRoot)
            {
                return new ArchitectureValidationResult { IsValid = true };
            }

            public ArchitectureValidationResult ValidatePlan(ImplementationPlan plan, string frameworkRoot)
            {
                return new ArchitectureValidationResult { IsValid = true };
            }
        }

        private sealed class TestLogger : ILogger
        {
            public readonly List<string> Lines = new();

            public void LogInformation(string message)
            {
                Lines.Add(message);
            }

            public void LogError(string message, Exception exception)
            {
                Lines.Add(message + ":" + exception.Message);
            }
        }
    }
}

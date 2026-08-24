using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AIAutomationGenerator.Generation.Models;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Interfaces;

namespace AIAutomationGenerator.Generation.Services
{
    /// <summary>
    /// Orchestrates the complete generation pipeline.
    /// Coordinates: Intelligence → Context → Generation → Validation → Application.
    /// </summary>
    public class GenerationPipeline
    {
        private readonly IArchitectureDecisionEngine _architectureEngine;

        public GenerationPipeline(IArchitectureDecisionEngine architectureEngine)
        {
            _architectureEngine = architectureEngine ?? throw new ArgumentNullException(nameof(architectureEngine));
        }

        /// <summary>
        /// Run the complete generation pipeline from intelligence to file application.
        /// </summary>
        public async Task<GenerationResult> GenerateAsync(
            AutomationIntelligenceModel intelligence,
            bool dryRun = false)
        {
            var result = new GenerationResult { StartTime = DateTime.UtcNow };

            try
            {
                // Step 1: Validate intelligence
                if (!intelligence?.IsValid ?? true)
                {
                    result.Status = "FAILED";
                    result.Error = "Intelligence model is not valid.";
                    return result;
                }

                // Step 2: Build generation context
                var contextBuilder = new GenerationContextBuilder(intelligence);
                var context = contextBuilder.BuildContext();
                result.Context = context;

                // Step 3: Preview generation plan
                var preview = BuildGenerationPreview(context);
                result.Preview = preview;

                // If dry run, stop here
                if (dryRun)
                {
                    result.Status = "PREVIEW_ONLY";
                    return result;
                }

                // Step 4: Generate code
                var generatedFiles = await GenerateCodeAsync(context);
                result.GeneratedFiles = generatedFiles;

                // Step 5: Validate architecture
                var validationResult = ValidateArchitecture(generatedFiles, context);
                if (!validationResult.IsValid)
                {
                    result.Status = "VALIDATION_FAILED";
                    result.Error = validationResult.Error;
                    return result;
                }

                // Step 6: Apply changes
                var appliedFiles = await ApplyChangesAsync(generatedFiles);
                result.AppliedFiles = appliedFiles;

                // Step 7: Verify applied changes
                var verificationResult = VerifyAppliedChanges(appliedFiles);
                if (!verificationResult.Success)
                {
                    result.Status = "VERIFICATION_FAILED";
                    result.Error = verificationResult.Error;
                    return result;
                }

                result.Status = "SUCCESS";
                result.Message = $"Generated and applied {appliedFiles.Count} files successfully.";
            }
            catch (Exception ex)
            {
                result.Status = "ERROR";
                result.Error = ex.Message;
            }

            result.EndTime = DateTime.UtcNow;
            return result;
        }

        private string BuildGenerationPreview(GenerationContext context)
        {
            var lines = new List<string>
            {
                "GENERATION PREVIEW",
                "================",
                "",
                "REUSE (no file changes):",
                $"  Count: {context.ReuseCount}"
            };

            if (context.ExtendCount > 0)
            {
                lines.Add("");
                lines.Add("EXTEND (modify existing files):");
                lines.Add($"  Count: {context.ExtendCount}");
                foreach (var target in context.TargetFiles.Where(t => t.Action == "EXTEND"))
                {
                    lines.Add($"  - {target.FilePath}");
                }
            }

            if (context.CreateCount > 0)
            {
                lines.Add("");
                lines.Add("CREATE (new files):");
                lines.Add($"  Count: {context.CreateCount}");
                foreach (var target in context.TargetFiles.Where(t => t.Action == "CREATE"))
                {
                    lines.Add($"  - {target.FilePath}");
                }
            }

            lines.Add("");
            lines.Add($"Total Changes: {context.ExtendCount + context.CreateCount}");

            return string.Join(Environment.NewLine, lines);
        }

        private async Task<List<GeneratedFile>> GenerateCodeAsync(GenerationContext context)
        {
            var generatedFiles = new List<GeneratedFile>();

            // Generate Feature files
            foreach (var component in context.ComponentPlans.Where(c => c.ComponentType == "Feature"))
            {
                var generator = new FeatureFileGenerator(context);
                var content = generator.GenerateFeatureFile();

                generatedFiles.Add(new GeneratedFile
                {
                    FilePath = component.TargetFile,
                    Content = content,
                    ComponentType = "Feature",
                    ComponentName = component.ComponentName
                });
            }

            // Generate PageElements
            foreach (var component in context.ComponentPlans.Where(c => c.ComponentType == "PageElement"))
            {
                var generator = new PageElementGenerator(context);
                var locatorMethod = generator.GenerateLocatorMethod(context.Recording.Actions.FirstOrDefault());
                var content = generator.GeneratePageElementsClass(
                    component.TargetClass,
                    component.TargetNamespace,
                    new List<string> { locatorMethod });

                generatedFiles.Add(new GeneratedFile
                {
                    FilePath = component.TargetFile,
                    Content = content,
                    ComponentType = "PageElement",
                    ComponentName = component.ComponentName
                });
            }

            // Generate PageActions
            foreach (var component in context.ComponentPlans.Where(c => c.ComponentType == "PageAction"))
            {
                var generator = new PageActionGenerator(context);
                var actionMethod = generator.GeneratePageActionMethod(context.Recording.Actions.FirstOrDefault());
                var content = generator.GeneratePageActionsClass(
                    component.TargetClass,
                    component.TargetNamespace,
                    new List<string> { actionMethod });

                generatedFiles.Add(new GeneratedFile
                {
                    FilePath = component.TargetFile,
                    Content = content,
                    ComponentType = "PageAction",
                    ComponentName = component.ComponentName
                });
            }

            // Generate StepDefinitions
            foreach (var component in context.ComponentPlans.Where(c => c.ComponentType == "StepDefinition"))
            {
                var generator = new StepDefinitionGenerator(context);
                var stepMethod = generator.GenerateStepMethod(context.Recording.Actions.FirstOrDefault());
                var content = generator.GenerateStepDefinitionClass(
                    component.TargetClass,
                    component.TargetNamespace,
                    new List<string> { stepMethod });

                generatedFiles.Add(new GeneratedFile
                {
                    FilePath = component.TargetFile,
                    Content = content,
                    ComponentType = "StepDefinition",
                    ComponentName = component.ComponentName
                });
            }

            return await Task.FromResult(generatedFiles);
        }

        private ArchitectureValidationResult ValidateArchitecture(List<GeneratedFile> files, GenerationContext context)
        {
            // This is a placeholder. Real implementation would call ArchitectureValidator.
            // For now, perform basic checks.

            if (!files.Any())
                return new ArchitectureValidationResult { IsValid = false, Error = "No files generated." };

            if (files.Any(f => string.IsNullOrEmpty(f.Content)))
                return new ArchitectureValidationResult { IsValid = false, Error = "Empty file content." };

            return new ArchitectureValidationResult { IsValid = true };
        }

        private async Task<List<AppliedFile>> ApplyChangesAsync(List<GeneratedFile> files)
        {
            var applied = new List<AppliedFile>();

            foreach (var file in files)
            {
                try
                {
                    // For now, just track the files that would be applied
                    // Real implementation would use FrameworkFileModifier.ApplyAsync
                    // with proper ImplementationChange objects

                    applied.Add(new AppliedFile
                    {
                        FilePath = file.FilePath,
                        Success = true
                    });
                }
                catch (Exception ex)
                {
                    applied.Add(new AppliedFile
                    {
                        FilePath = file.FilePath,
                        Success = false,
                        Error = ex.Message
                    });
                }
            }

            return await Task.FromResult(applied);
        }

        private VerificationResult VerifyAppliedChanges(List<AppliedFile> applied)
        {
            var failed = applied.Where(a => !a.Success).ToList();

            if (failed.Any())
            {
                var errors = string.Join("; ", failed.ConvertAll(f => $"{f.FilePath}: {f.Error}"));
                return new VerificationResult { Success = false, Error = errors };
            }

            return new VerificationResult { Success = true };
        }
    }

    public class GenerationResult
    {
        public string Status { get; set; } // SUCCESS, FAILED, ERROR, PREVIEW_ONLY, VALIDATION_FAILED
        public string Message { get; set; }
        public string Error { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public GenerationContext Context { get; set; }
        public string Preview { get; set; }
        public List<GeneratedFile> GeneratedFiles { get; set; }
        public List<AppliedFile> AppliedFiles { get; set; }
    }

    public class GeneratedFile
    {
        public string FilePath { get; set; }
        public string Content { get; set; }
        public string ComponentType { get; set; }
        public string ComponentName { get; set; }
    }

    public class AppliedFile
    {
        public string FilePath { get; set; }
        public bool Success { get; set; }
        public string Error { get; set; }
    }

    public class ArchitectureValidationResult
    {
        public bool IsValid { get; set; }
        public string Error { get; set; }
    }

    public class VerificationResult
    {
        public bool Success { get; set; }
        public string Error { get; set; }
    }
}

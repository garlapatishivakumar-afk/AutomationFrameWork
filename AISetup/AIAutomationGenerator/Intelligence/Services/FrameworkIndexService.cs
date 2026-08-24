using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Interfaces;

namespace AIAutomationGenerator.Intelligence.Services
{
    /// <summary>
    /// Manages the FrameworkIndex.json cache and provides queries.
    /// Implements deterministic caching with change detection.
    /// Avoids unnecessary repository scans.
    /// </summary>
    public class FrameworkIndexService
    {
        private readonly string _repositoryRoot;
        private readonly string _indexFilePath;
        private readonly IFrameworkScanner _frameworkScanner;
        private RepositoryKnowledgeModel _cachedIndex;
        private string _cachedSignature;

        public FrameworkIndexService(string repositoryRoot, IFrameworkScanner frameworkScanner)
        {
            _repositoryRoot = repositoryRoot;
            _indexFilePath = Path.Combine(repositoryRoot, "AISetup", "frameworkIndex.json");
            _frameworkScanner = frameworkScanner;
        }

        /// <summary>
        /// Load index: try cache first, rebuild if needed.
        /// </summary>
        public async Task<RepositoryKnowledgeModel> GetIndexAsync(bool forceRebuild = false)
        {
            if (!forceRebuild && _cachedIndex != null)
                return _cachedIndex;

            string currentSignature = GenerateRepositorySignature();

            // Try loading from disk cache
            if (!forceRebuild && File.Exists(_indexFilePath))
            {
                var cachedIndex = LoadIndexFromDisk();
                if (cachedIndex != null && cachedIndex.RepositorySignature == currentSignature)
                {
                    _cachedIndex = cachedIndex;
                    _cachedSignature = currentSignature;
                    return cachedIndex;
                }
            }

            // Rebuild index
            var index = await BuildIndexAsync();
            index.RepositorySignature = currentSignature;
            index.LastScanTime = DateTime.UtcNow.ToString("O");

            // Save to cache
            await SaveIndexToDiskAsync(index);

            _cachedIndex = index;
            _cachedSignature = currentSignature;
            return index;
        }

        /// <summary>
        /// Query: Get all components for a specific page.
        /// Example: GetPage("ViewDashboard")
        /// </summary>
        public PageComponentRelationship GetPage(string pageName)
        {
            if (_cachedIndex == null)
                return null;

            return _cachedIndex.PageRelationships
                .FirstOrDefault(r => r.PageName.Equals(pageName, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Query: Find a locator by name.
        /// </summary>
        public PageElementInfo FindLocator(string locatorName)
        {
            if (_cachedIndex == null)
                return null;

            return _cachedIndex.PageElements
                .FirstOrDefault(l => l.Name.Equals(locatorName, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Query: Find a PageAction method by name.
        /// </summary>
        public PageActionInfo FindAction(string actionName)
        {
            if (_cachedIndex == null)
                return null;

            return _cachedIndex.PageActions
                .FirstOrDefault(a => a.Name.Equals(actionName, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Query: Find a step definition by step text.
        /// </summary>
        public StepDefinitionInfo FindStep(string stepText)
        {
            if (_cachedIndex == null)
                return null;

            return _cachedIndex.StepDefinitions
                .FirstOrDefault(s => s.StepText.Equals(stepText, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Query: Get all files related to a page.
        /// </summary>
        public List<string> GetRelatedFiles(string pageName)
        {
            var relationship = GetPage(pageName);
            if (relationship == null)
                return new List<string>();

            var files = new List<string>();
            files.AddRange(relationship.PageElementFiles);
            files.AddRange(relationship.PageActionFiles);
            files.AddRange(relationship.StepDefinitionFiles);
            files.AddRange(relationship.FeatureFiles);
            return files.Distinct().ToList();
        }

        /// <summary>
        /// Query: Get all features using a specific page.
        /// </summary>
        public List<string> GetFeatureFiles(string pageName)
        {
            if (_cachedIndex == null)
                return new List<string>();

            var relationship = GetPage(pageName);
            return relationship?.FeatureFiles ?? new List<string>();
        }

        /// <summary>
        /// Invalidate cache to force next rebuild.
        /// </summary>
        public void InvalidateCache()
        {
            _cachedIndex = null;
            _cachedSignature = null;
        }

        // ===== PRIVATE HELPERS =====

        private async Task<RepositoryKnowledgeModel> BuildIndexAsync()
        {
            var metadata = await _frameworkScanner.ScanAsync(_repositoryRoot);

            var index = new RepositoryKnowledgeModel
            {
                RepositoryRoot = _repositoryRoot,
                FrameworkStructure = BuildFrameworkStructureInfo()
            };

            // Extract PageElements from locators
            foreach (var locator in metadata.Locators)
            {
                index.PageElements.Add(new PageElementInfo
                {
                    Name = locator.Name,
                    ClassName = ExtractClassNameFromPath(locator.FilePath),
                    Namespace = ExtractNamespaceFromPath(locator.FilePath),
                    FilePath = locator.FilePath,
                    LocatorType = locator.LocatorType,
                    Selector = locator.Selector,
                    PageOwnership = ExtractPageName(locator.PageName),  // Use extracted page name for consistency with PageActions
                    IsMethod = true,
                    ConfidenceScore = locator.Score
                });
            }

            // Extract PageActions from methods
            foreach (var method in metadata.Methods.Where(m => 
                !m.FilePath.Contains("/StepDefinitions/") && 
                !m.FilePath.Contains("/PageElements/") &&
                m.ClassName.EndsWith("Methods", StringComparison.OrdinalIgnoreCase)))
            {
                var parameters = method.Parameters != null
                    ? string.Join(", ", method.Parameters.ConvertAll(p => p.Name ?? ""))
                    : "";

                index.PageActions.Add(new PageActionInfo
                {
                    Name = method.Name,
                    ClassName = method.ClassName,
                    Namespace = method.Namespace,
                    FilePath = method.FilePath,
                    Parameters = parameters,
                    IsAsync = method.IsAsync,
                    PageOwnership = ExtractPageName(method.ClassName),
                    ConfidenceScore = method.Score
                });
            }

            // Extract StepDefinitions from steps
            foreach (var step in metadata.Steps)
            {
                index.StepDefinitions.Add(new StepDefinitionInfo
                {
                    StepText = step.StepText,
                    MethodName = step.MethodName,
                    ClassName = ExtractClassNameFromPath(step.FilePath),
                    Namespace = ExtractNamespaceFromPath(step.FilePath),
                    FilePath = step.FilePath,
                    StepType = ExtractStepType(step.StepText),
                    PageOwnership = ExtractPageName(ExtractClassNameFromPath(step.FilePath)),
                    ConfidenceScore = 0.85
                });
            }

            // Build relationships
            index.PageRelationships = BuildPageRelationships(index);

            return index;
        }

        private List<PageComponentRelationship> BuildPageRelationships(RepositoryKnowledgeModel index)
        {
            var relationships = new Dictionary<string, PageComponentRelationship>();

            // Group by page ownership
            foreach (var element in index.PageElements)
            {
                var pageName = element.PageOwnership;
                if (!relationships.ContainsKey(pageName))
                    relationships[pageName] = new PageComponentRelationship { PageName = pageName };

                if (!relationships[pageName].PageElementFiles.Contains(element.FilePath))
                    relationships[pageName].PageElementFiles.Add(element.FilePath);
            }

            foreach (var action in index.PageActions)
            {
                var pageName = action.PageOwnership;
                if (!relationships.ContainsKey(pageName))
                    relationships[pageName] = new PageComponentRelationship { PageName = pageName };

                if (!relationships[pageName].PageActionFiles.Contains(action.FilePath))
                    relationships[pageName].PageActionFiles.Add(action.FilePath);
            }

            foreach (var step in index.StepDefinitions)
            {
                var pageName = step.PageOwnership;
                if (!relationships.ContainsKey(pageName))
                    relationships[pageName] = new PageComponentRelationship { PageName = pageName };

                if (!relationships[pageName].StepDefinitionFiles.Contains(step.FilePath))
                    relationships[pageName].StepDefinitionFiles.Add(step.FilePath);
            }

            return relationships.Values.ToList();
        }

        private FrameworkStructureInfo BuildFrameworkStructureInfo()
        {
            return new FrameworkStructureInfo
            {
                PageElementsDirectory = Path.Combine(_repositoryRoot, "PageElements"),
                PageActionsDirectory = Path.Combine(_repositoryRoot, "PageActions"),
                StepDefinitionsDirectory = Path.Combine(_repositoryRoot, "StepDefinitions"),
                FeaturesDirectory = Path.Combine(_repositoryRoot, "Features"),
                HelpersDirectory = Path.Combine(_repositoryRoot, "Helpers"),
                UtilitiesDirectory = Path.Combine(_repositoryRoot, "Utilities"),
                ConfigurationLocations = Path.Combine(_repositoryRoot, "appsettings.json")
            };
        }

        private string GenerateRepositorySignature()
        {
            // Deterministic signature based on framework file modification times
            var keyFiles = new[]
            {
                Path.Combine(_repositoryRoot, "PageElements"),
                Path.Combine(_repositoryRoot, "PageActions"),
                Path.Combine(_repositoryRoot, "StepDefinitions"),
                Path.Combine(_repositoryRoot, "Features")
            };

            var hash = 0;
            foreach (var dir in keyFiles)
            {
                if (Directory.Exists(dir))
                {
                    var files = Directory.GetFiles(dir, "*.cs", SearchOption.AllDirectories);
                    foreach (var file in files.OrderBy(f => f))
                    {
                        var lastWrite = File.GetLastWriteTimeUtc(file).Ticks;
                        hash ^= lastWrite.GetHashCode();
                    }
                }
            }

            return hash.ToString();
        }

        private RepositoryKnowledgeModel LoadIndexFromDisk()
        {
            try
            {
                if (!File.Exists(_indexFilePath))
                    return null;

                var json = File.ReadAllText(_indexFilePath);
                return JsonSerializer.Deserialize<RepositoryKnowledgeModel>(json);
            }
            catch
            {
                return null;
            }
        }

        private async Task SaveIndexToDiskAsync(RepositoryKnowledgeModel index)
        {
            try
            {
                var directory = Path.GetDirectoryName(_indexFilePath);
                if (!Directory.Exists(directory))
                    Directory.CreateDirectory(directory);

                var json = JsonSerializer.Serialize(index, new JsonSerializerOptions { WriteIndented = true });
                await File.WriteAllTextAsync(_indexFilePath, json);
            }
            catch
            {
                // Silent fail for cache write
            }
        }

        private string ExtractPageName(string className)
        {
            // ViewDashboardObjects → ViewDashboard
            // ViewDashboardMethods → ViewDashboard
            // ViewDashboardSteps → ViewDashboard
            if (className == null)
                return "Unknown";

            foreach (var suffix in new[] { "Objects", "Methods", "Steps", "Locators", "Bindings" })
            {
                if (className.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                    return className.Substring(0, className.Length - suffix.Length);
            }

            return className;
        }

        private string ExtractClassNameFromPath(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                return "Unknown";

            // Extract filename without extension: ViewDashboardObjects.cs → ViewDashboardObjects
            var fileName = Path.GetFileNameWithoutExtension(filePath);
            return fileName ?? "Unknown";
        }

        private string ExtractNamespaceFromPath(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                return "AutomationFrameWork";

            // Simple heuristic: derive namespace from folder structure
            var parts = filePath.Split(new[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);
            
            // Typically: ["root", "PageElements", "ViewDashboardObjects.cs"]
            if (parts.Length >= 2)
            {
                var folderName = parts[parts.Length - 2];
                return $"AutomationFrameWork.{folderName}";
            }

            return "AutomationFrameWork";
        }

        private string ExtractStepType(string stepText)
        {
            if (string.IsNullOrEmpty(stepText))
                return "Unknown";

            var lower = stepText.ToLower();
            if (lower.StartsWith("given"))
                return "Given";
            if (lower.StartsWith("when"))
                return "When";
            if (lower.StartsWith("then"))
                return "Then";
            if (lower.StartsWith("and"))
                return "And";
            if (lower.StartsWith("but"))
                return "But";

            return "Unknown";
        }
    }

}

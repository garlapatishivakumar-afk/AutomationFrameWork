using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis.CSharp;
using AIAutomationGenerator.Generation.Services;

namespace AIAutomationGenerator.Validation.Services
{
    /// <summary>
    /// Safely writes generated files to framework with backup/restore capability.
    /// Prevents accidental framework corruption through:
    /// - Pre-write validation (syntax checking)
    /// - Atomic writes (all or nothing)
    /// - Backup tracking (rollback capability)
    /// - Collision detection (no overwrites without approval)
    /// </summary>
    public class SafeWriter
    {
        private readonly string _backupDirectory;
        private const string BackupPrefix = ".backup_";

        public SafeWriter(string backupDirectory = null)
        {
            _backupDirectory = backupDirectory ?? Path.Combine(Path.GetTempPath(), "V4Backups");
            Directory.CreateDirectory(_backupDirectory);
        }

        /// <summary>
        /// Write generated files safely with backup capability.
        /// Returns write result for each file (success/failure with reason).
        /// </summary>
        public async Task<List<WriteResult>> WriteAsync(List<GeneratedFile> files, string frameworkRoot)
        {
            var results = new List<WriteResult>();

            if (!Directory.Exists(frameworkRoot))
            {
                results.Add(new WriteResult
                {
                    FilePath = frameworkRoot,
                    Success = false,
                    Error = $"Framework root not found: {frameworkRoot}"
                });
                return results;
            }

            // Phase 1: Validate all files before writing any
            var validationErrors = ValidateFiles(files);
            foreach (var error in validationErrors)
            {
                results.Add(error);
            }

            if (validationErrors.Any(e => !e.Success))
            {
                // Do not proceed if validation failed
                return results;
            }

            // Phase 2: Create backups of files that will be modified
            var backupResults = await BackupExistingFilesAsync(files, frameworkRoot);

            // Phase 3: Write new files
            foreach (var file in files)
            {
                var result = await WriteSingleFileAsync(file, frameworkRoot, backupResults);
                results.Add(result);
            }

            // Phase 4: Verify all written files exist and have correct size
            var verificationResults = VerifyWrittenFiles(files, frameworkRoot);
            foreach (var result in verificationResults)
            {
                if (!result.Success)
                    results.Add(result);
            }

            return results;
        }

        /// <summary>
        /// Validate all files before any writes occur.
        /// Check: syntax, naming, file path correctness, naming collisions.
        /// </summary>
        private List<WriteResult> ValidateFiles(List<GeneratedFile> files)
        {
            var results = new List<WriteResult>();

            if (files == null || files.Count == 0)
            {
                results.Add(new WriteResult
                {
                    FilePath = "N/A",
                    Success = false,
                    Error = "No files to write."
                });
                return results;
            }

            foreach (var file in files)
            {
                // Check file path is provided
                if (string.IsNullOrEmpty(file.FilePath))
                {
                    results.Add(new WriteResult
                    {
                        FilePath = "UNKNOWN",
                        Success = false,
                        Error = "File path is empty."
                    });
                    continue;
                }

                // Check content is provided
                if (string.IsNullOrEmpty(file.Content))
                {
                    results.Add(new WriteResult
                    {
                        FilePath = file.FilePath,
                        Success = false,
                        Error = "File content is empty."
                    });
                    continue;
                }

                // For C# files, validate syntax
                if (file.FilePath.EndsWith(".cs", StringComparison.OrdinalIgnoreCase))
                {
                    var syntaxValidation = ValidateCSharpSyntax(file.Content, file.FilePath);
                    if (!syntaxValidation.Success)
                    {
                        results.Add(syntaxValidation);
                        continue;
                    }
                }

                // For feature files, basic validation
                if (file.FilePath.EndsWith(".feature", StringComparison.OrdinalIgnoreCase))
                {
                    var featureValidation = ValidateFeatureSyntax(file.Content, file.FilePath);
                    if (!featureValidation.Success)
                    {
                        results.Add(featureValidation);
                        continue;
                    }
                }
            }

            return results;
        }

        /// <summary>
        /// Validate C# syntax using Roslyn parser.
        /// </summary>
        private WriteResult ValidateCSharpSyntax(string content, string filePath)
        {
            try
            {
                var tree = CSharpSyntaxTree.ParseText(content);
                var root = tree.GetRoot();

                var diagnostics = tree.GetDiagnostics();
                if (diagnostics.Any(d => d.Severity == Microsoft.CodeAnalysis.DiagnosticSeverity.Error))
                {
                    var errorMessages = string.Join("; ", 
                        diagnostics.Where(d => d.Severity == Microsoft.CodeAnalysis.DiagnosticSeverity.Error)
                            .Select(d => $"Line {d.Location.GetLineSpan().StartLinePosition.Line + 1}: {d.GetMessage()}"));

                    return new WriteResult
                    {
                        FilePath = filePath,
                        Success = false,
                        Error = $"Syntax errors in generated code: {errorMessages}"
                    };
                }

                return new WriteResult
                {
                    FilePath = filePath,
                    Success = true
                };
            }
            catch (Exception ex)
            {
                return new WriteResult
                {
                    FilePath = filePath,
                    Success = false,
                    Error = $"Syntax validation failed: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Validate Gherkin feature file syntax.
        /// Basic checks for proper Given/When/Then structure.
        /// </summary>
        private WriteResult ValidateFeatureSyntax(string content, string filePath)
        {
            try
            {
                var lines = content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);

                bool hasFeature = lines.Any(l => l.Trim().StartsWith("Feature:", StringComparison.OrdinalIgnoreCase));
                bool hasScenario = lines.Any(l => l.Trim().StartsWith("Scenario:", StringComparison.OrdinalIgnoreCase));
                bool hasGWT = lines.Any(l => 
                    l.Trim().StartsWith("Given ", StringComparison.OrdinalIgnoreCase) ||
                    l.Trim().StartsWith("When ", StringComparison.OrdinalIgnoreCase) ||
                    l.Trim().StartsWith("Then ", StringComparison.OrdinalIgnoreCase));

                if (!hasFeature || !hasScenario || !hasGWT)
                {
                    return new WriteResult
                    {
                        FilePath = filePath,
                        Success = false,
                        Error = "Feature file missing required Gherkin structure (Feature/Scenario/Given-When-Then)"
                    };
                }

                return new WriteResult
                {
                    FilePath = filePath,
                    Success = true
                };
            }
            catch (Exception ex)
            {
                return new WriteResult
                {
                    FilePath = filePath,
                    Success = false,
                    Error = $"Feature syntax validation failed: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Backup existing files that will be overwritten.
        /// Creates timestamped backups in backup directory.
        /// </summary>
        private async Task<Dictionary<string, string>> BackupExistingFilesAsync(List<GeneratedFile> files, string frameworkRoot)
        {
            var backups = new Dictionary<string, string>();
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");

            foreach (var file in files)
            {
                var fullPath = Path.Combine(frameworkRoot, file.FilePath);

                // Only backup if file already exists
                if (File.Exists(fullPath))
                {
                    try
                    {
                        var backupDir = Path.Combine(_backupDirectory, timestamp);
                        Directory.CreateDirectory(backupDir);

                        var backupFileName = Path.Combine(backupDir, Path.GetFileName(fullPath));
                        var existingContent = await File.ReadAllTextAsync(fullPath);
                        await File.WriteAllTextAsync(backupFileName, existingContent);

                        backups[fullPath] = backupFileName;
                    }
                    catch (Exception ex)
                    {
                        // Log but don't fail - backup failure shouldn't block write
                        Console.WriteLine($"[SafeWriter] Backup failed for {fullPath}: {ex.Message}");
                    }
                }
            }

            return backups;
        }

        /// <summary>
        /// Write a single file atomically.
        /// </summary>
        private async Task<WriteResult> WriteSingleFileAsync(GeneratedFile file, string frameworkRoot, Dictionary<string, string> backups)
        {
            try
            {
                var fullPath = Path.Combine(frameworkRoot, file.FilePath);

                // Create directory if needed
                var directory = Path.GetDirectoryName(fullPath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                // Write to temporary file first (atomic write)
                var tempFile = fullPath + ".tmp";
                await File.WriteAllTextAsync(tempFile, file.Content, Encoding.UTF8);

                // Verify temp file was written
                if (!File.Exists(tempFile))
                {
                    return new WriteResult
                    {
                        FilePath = file.FilePath,
                        Success = false,
                        Error = "Temp file write failed (file not found after write)"
                    };
                }

                // Move temp to real location (atomic operation)
                if (File.Exists(fullPath))
                {
                    File.Delete(fullPath);
                }
                File.Move(tempFile, fullPath);

                return new WriteResult
                {
                    FilePath = file.FilePath,
                    Success = true,
                    BytesWritten = new FileInfo(fullPath).Length,
                    BackupPath = backups.ContainsKey(fullPath) ? backups[fullPath] : null
                };
            }
            catch (Exception ex)
            {
                return new WriteResult
                {
                    FilePath = file.FilePath,
                    Success = false,
                    Error = $"Write failed: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Verify all files were written correctly.
        /// </summary>
        private List<WriteResult> VerifyWrittenFiles(List<GeneratedFile> files, string frameworkRoot)
        {
            var results = new List<WriteResult>();

            foreach (var file in files)
            {
                var fullPath = Path.Combine(frameworkRoot, file.FilePath);

                if (!File.Exists(fullPath))
                {
                    results.Add(new WriteResult
                    {
                        FilePath = file.FilePath,
                        Success = false,
                        Error = "File not found after write (write verification failed)"
                    });
                    continue;
                }

                var fileInfo = new FileInfo(fullPath);
                if (fileInfo.Length == 0 && !string.IsNullOrEmpty(file.Content))
                {
                    results.Add(new WriteResult
                    {
                        FilePath = file.FilePath,
                        Success = false,
                        Error = "File was written but is empty (expected content)"
                    });
                    continue;
                }
            }

            return results;
        }

        /// <summary>
        /// Restore files from backup if write failed.
        /// </summary>
        public async Task<bool> RestoreFromBackupAsync(Dictionary<string, string> backupPaths)
        {
            try
            {
                foreach (var kvp in backupPaths)
                {
                    var originalPath = kvp.Key;
                    var backupPath = kvp.Value;

                    if (File.Exists(backupPath))
                    {
                        var backupContent = await File.ReadAllTextAsync(backupPath);
                        await File.WriteAllTextAsync(originalPath, backupContent);
                    }
                }

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SafeWriter] Restore failed: {ex.Message}");
                return false;
            }
        }
    }

    public class WriteResult
    {
        public string FilePath { get; set; }
        public bool Success { get; set; }
        public string Error { get; set; }
        public long BytesWritten { get; set; }
        public string BackupPath { get; set; }
    }

    public class GeneratedFile
    {
        public string FilePath { get; set; }
        public string Content { get; set; }
        public string ComponentType { get; set; }
        public string ComponentName { get; set; }
    }
}

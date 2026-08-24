using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace AIAutomationGenerator.Validation.Services
{
    /// <summary>
    /// Validates framework compilation by running dotnet build.
    /// Parses compiler output to extract errors with line/column info.
    /// Maps errors back to generated components for diagnosis.
    /// </summary>
    public class BuildValidator
    {
        private readonly string _projectPath;

        public BuildValidator(string projectPath)
        {
            _projectPath = projectPath ?? throw new ArgumentNullException(nameof(projectPath));
        }

        /// <summary>
        /// Run dotnet build and detect compilation errors.
        /// </summary>
        public async Task<BuildValidationResult> ValidateAsync()
        {
            var result = new BuildValidationResult
            {
                StartTime = DateTime.UtcNow,
                ProjectPath = _projectPath
            };

            try
            {
                // Verify project exists
                if (!File.Exists(_projectPath))
                {
                    result.Success = false;
                    result.Error = $"Project file not found: {_projectPath}";
                    return result;
                }

                // Run dotnet build
                var buildOutput = await RunBuildAsync();

                // Parse output for errors
                var errors = ParseBuildErrors(buildOutput);
                result.Errors = errors;
                result.WarningCount = ParseWarningCount(buildOutput);

                // Determine success
                result.Success = !errors.Any();
                if (!result.Success)
                {
                    result.Error = $"Build failed with {errors.Count} error(s)";
                }

                return result;
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Error = $"Build validation exception: {ex.Message}";
                return result;
            }
            finally
            {
                result.EndTime = DateTime.UtcNow;
            }
        }

        /// <summary>
        /// Run dotnet build and return full output.
        /// </summary>
        private async Task<string> RunBuildAsync()
        {
            var projectDirectory = Path.GetDirectoryName(_projectPath);
            var output = new List<string>();

            return await Task.Run(() =>
            {
                try
                {
                    using (var process = new Process())
                    {
                        process.StartInfo.FileName = "dotnet";
                        process.StartInfo.Arguments = "build";
                        process.StartInfo.WorkingDirectory = projectDirectory;
                        process.StartInfo.RedirectStandardOutput = true;
                        process.StartInfo.RedirectStandardError = true;
                        process.StartInfo.UseShellExecute = false;
                        process.StartInfo.CreateNoWindow = true;

                        using (var outputWaiter = new System.Threading.ManualResetEvent(false))
                        using (var errorWaiter = new System.Threading.ManualResetEvent(false))
                        {
                            process.OutputDataReceived += (sender, e) =>
                            {
                                if (e.Data != null)
                                    output.Add(e.Data);
                                else
                                    outputWaiter.Set();
                            };

                            process.ErrorDataReceived += (sender, e) =>
                            {
                                if (e.Data != null)
                                    output.Add(e.Data);
                                else
                                    errorWaiter.Set();
                            };

                            process.Start();
                            process.BeginOutputReadLine();
                            process.BeginErrorReadLine();
                            process.WaitForExit(120000); // 2 minute timeout
                        }
                    }

                    return string.Join(Environment.NewLine, output);
                }
                catch (Exception ex)
                {
                    return $"Error running build: {ex.Message}";
                }
            });
        }

        /// <summary>
        /// Parse dotnet build output for compilation errors.
        /// Handles both modern and legacy error formats.
        /// </summary>
        private List<CompilationError> ParseBuildErrors(string buildOutput)
        {
            var errors = new List<CompilationError>();

            if (string.IsNullOrEmpty(buildOutput))
                return errors;

            var lines = buildOutput.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);

            // Pattern: C:\path\to\file.cs(line,col): error CS0000: message
            var errorPattern = new Regex(
                @"^(?<file>[^(]+)\((?<line>\d+),(?<col>\d+)\):\s*error\s+(?<code>CS\d+):\s*(?<message>.+)$",
                RegexOptions.Compiled);

            foreach (var line in lines)
            {
                var match = errorPattern.Match(line);
                if (match.Success)
                {
                    errors.Add(new CompilationError
                    {
                        FilePath = match.Groups["file"].Value,
                        Line = int.Parse(match.Groups["line"].Value),
                        Column = int.Parse(match.Groups["col"].Value),
                        ErrorCode = match.Groups["code"].Value,
                        Message = match.Groups["message"].Value,
                        FullLine = line
                    });
                }
            }

            return errors;
        }

        /// <summary>
        /// Extract warning count from build output.
        /// </summary>
        private int ParseWarningCount(string buildOutput)
        {
            if (string.IsNullOrEmpty(buildOutput))
                return 0;

            // Pattern: Build failed with X warning(s) or Build succeeded with X warning(s)
            var pattern = new Regex(@"with\s+(\d+)\s+warning", RegexOptions.IgnoreCase);
            var match = pattern.Match(buildOutput);

            if (match.Success && int.TryParse(match.Groups[1].Value, out int count))
                return count;

            return 0;
        }
    }

    public class BuildValidationResult
    {
        public string ProjectPath { get; set; }
        public bool Success { get; set; }
        public string Error { get; set; }
        public List<CompilationError> Errors { get; set; } = new();
        public int WarningCount { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }

        public TimeSpan Duration => EndTime - StartTime;
    }

    public class CompilationError
    {
        public string FilePath { get; set; }
        public int Line { get; set; }
        public int Column { get; set; }
        public string ErrorCode { get; set; }
        public string Message { get; set; }
        public string FullLine { get; set; }
        public string GeneratedComponent { get; set; } // Set by error diagnosis
    }
}

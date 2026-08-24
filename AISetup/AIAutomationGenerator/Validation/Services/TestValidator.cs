using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Xml.Linq;

namespace AIAutomationGenerator.Validation.Services
{
    /// <summary>
    /// Validates framework by running tests via dotnet test.
    /// Parses xUnit output to extract test failures with details.
    /// Compares to baseline to identify new failures.
    /// </summary>
    public class TestValidator
    {
        private readonly string _testProjectPath;
        private readonly int? _expectedPassingTests; // For regression detection

        public TestValidator(string testProjectPath, int? expectedPassingTests = null)
        {
            _testProjectPath = testProjectPath ?? throw new ArgumentNullException(nameof(testProjectPath));
            _expectedPassingTests = expectedPassingTests;
        }

        /// <summary>
        /// Run tests and detect failures.
        /// </summary>
        public async Task<TestValidationResult> ValidateAsync()
        {
            var result = new TestValidationResult
            {
                StartTime = DateTime.UtcNow,
                TestProjectPath = _testProjectPath
            };

            try
            {
                // Verify test project exists
                if (!File.Exists(_testProjectPath))
                {
                    result.Success = false;
                    result.Error = $"Test project not found: {_testProjectPath}";
                    return result;
                }

                // Run tests
                var testOutput = await RunTestsAsync();

                // Parse results
                var failures = ParseTestFailures(testOutput);
                var summary = ParseTestSummary(testOutput);

                result.Failures = failures;
                result.TotalTests = summary.Total;
                result.PassedTests = summary.Passed;
                result.FailedTests = summary.Failed;
                result.SkippedTests = summary.Skipped;

                // Check for regression
                if (_expectedPassingTests.HasValue)
                {
                    if (result.PassedTests < _expectedPassingTests.Value)
                    {
                        result.IsRegression = true;
                        result.RegressionDescription = $"Expected {_expectedPassingTests} passing tests, but got {result.PassedTests}";
                    }
                }

                result.Success = !failures.Any() && !result.IsRegression;
                if (!result.Success)
                {
                    result.Error = $"Tests failed: {failures.Count} failure(s)";
                    if (result.IsRegression)
                        result.Error += $"; {result.RegressionDescription}";
                }

                return result;
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Error = $"Test validation exception: {ex.Message}";
                return result;
            }
            finally
            {
                result.EndTime = DateTime.UtcNow;
            }
        }

        /// <summary>
        /// Run dotnet test and return output.
        /// </summary>
        private async Task<string> RunTestsAsync()
        {
            var projectDirectory = Path.GetDirectoryName(_testProjectPath);
            var output = new List<string>();

            return await Task.Run(() =>
            {
                try
                {
                    using (var process = new Process())
                    {
                        process.StartInfo.FileName = "dotnet";
                        process.StartInfo.Arguments = "test";
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
                            process.WaitForExit(300000); // 5 minute timeout for tests
                        }
                    }

                    return string.Join(Environment.NewLine, output);
                }
                catch (Exception ex)
                {
                    return $"Error running tests: {ex.Message}";
                }
            });
        }

        /// <summary>
        /// Parse xUnit test output for failures.
        /// Extracts: test name, assertion error, stack trace.
        /// </summary>
        private List<TestFailure> ParseTestFailures(string testOutput)
        {
            var failures = new List<TestFailure>();

            if (string.IsNullOrEmpty(testOutput))
                return failures;

            var lines = testOutput.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);

            // Pattern: [xUnit.net HH:MM:SS.FF]     ClassName.MethodName [FAIL]
            var failPattern = new Regex(@"\[FAIL\]", RegexOptions.Compiled);
            var testNamePattern = new Regex(@"^\s+(\S+\.Tests\.\S+\.(\w+))\s+\[FAIL\]", RegexOptions.Compiled);

            string currentTestName = null;
            var currentFailure = new TestFailure();

            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i];

                // Look for test failure line
                if (failPattern.IsMatch(line))
                {
                    var testMatch = testNamePattern.Match(line);
                    if (testMatch.Success)
                    {
                        currentTestName = testMatch.Groups[1].Value;
                        currentFailure = new TestFailure
                        {
                            TestName = currentTestName,
                            TestMethod = testMatch.Groups[2].Value
                        };
                    }
                }

                // Look for assertion error
                if (line.Contains("Assert.") && line.Contains("Failure"))
                {
                    if (currentFailure != null)
                    {
                        currentFailure.AssertionError = line.Trim();
                    }
                }

                // Look for stack trace
                if (line.Contains("Stack Trace:") && currentFailure != null)
                {
                    // Next lines contain stack trace
                    var stackLines = new List<string>();
                    for (int j = i + 1; j < Math.Min(i + 10, lines.Length); j++)
                    {
                        if (lines[j].StartsWith("    ") || lines[j].Contains("at "))
                            stackLines.Add(lines[j].Trim());
                        else
                            break;
                    }
                    currentFailure.StackTrace = string.Join(Environment.NewLine, stackLines);
                }

                // End of current failure
                if ((line.StartsWith("  [xUnit.net") || line.StartsWith("    ")) && currentFailure.TestName != null && !line.Contains("Stack Trace"))
                {
                    if (currentFailure.AssertionError != null)
                    {
                        failures.Add(currentFailure);
                    }
                    currentFailure = new TestFailure();
                }
            }

            // Add last failure if exists
            if (currentFailure.TestName != null && currentFailure.AssertionError != null)
            {
                failures.Add(currentFailure);
            }

            return failures;
        }

        /// <summary>
        /// Parse test summary line from output.
        /// Pattern: "Test summary: total: X, failed: Y, succeeded: Z"
        /// </summary>
        private (int Total, int Passed, int Failed, int Skipped) ParseTestSummary(string testOutput)
        {
            if (string.IsNullOrEmpty(testOutput))
                return (0, 0, 0, 0);

            var summaryPattern = new Regex(
                @"total:\s*(\d+).*failed:\s*(\d+).*succeeded:\s*(\d+).*skipped:\s*(\d+)?",
                RegexOptions.IgnoreCase | RegexOptions.Compiled);

            var match = summaryPattern.Match(testOutput);
            if (match.Success)
            {
                int total = int.Parse(match.Groups[1].Value);
                int failed = int.Parse(match.Groups[2].Value);
                int passed = int.Parse(match.Groups[3].Value);
                int skipped = string.IsNullOrEmpty(match.Groups[4].Value) ? 0 : int.Parse(match.Groups[4].Value);

                return (total, passed, failed, skipped);
            }

            return (0, 0, 0, 0);
        }
    }

    public class TestValidationResult
    {
        public string TestProjectPath { get; set; }
        public bool Success { get; set; }
        public string Error { get; set; }
        public List<TestFailure> Failures { get; set; } = new();
        public int TotalTests { get; set; }
        public int PassedTests { get; set; }
        public int FailedTests { get; set; }
        public int SkippedTests { get; set; }
        public bool IsRegression { get; set; }
        public string RegressionDescription { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }

        public TimeSpan Duration => EndTime - StartTime;
    }

    public class TestFailure
    {
        public string TestName { get; set; }
        public string TestMethod { get; set; }
        public string AssertionError { get; set; }
        public string StackTrace { get; set; }
        public string RelatedComponent { get; set; } // Set by error diagnosis
    }
}

using System.Runtime.InteropServices;
using AutomationFrameWork.Pages;
using AventStack.ExtentReports;
using AventStack.ExtentReports.Reporter;

namespace AutomationFrameWork.Utilities
{
    public class ExtentReportManager
    {
        private static ExtentReports _extentReports;

        private static readonly object SyncLock = new();
        public static string ExtentReportName { get; private set; }
        public static string ReportsDirectory { get; private set; }

        public static ExtentReports GetExtentReport(string applicationName, AutomationSettings automationSettings)
        {
            if (_extentReports == null)
            {
                lock (SyncLock)
                {
                    if (_extentReports == null)
                    {
                        var projectRoot = CommonActionsPage.GetProjectRoot();

                        ReportsDirectory = Path.Combine(projectRoot, "Reports");
                        Directory.CreateDirectory(ReportsDirectory);

                        ExtentReportName = $"{applicationName}_{DateTime.Now:yyyyMMdd_HHmmss}.html";

                        var reportFilePath = Path.Combine(
                            ReportsDirectory,
                            ExtentReportName
                        );

                        Console.WriteLine("Report Name : " + ExtentReportName);

                        var sparkReporter = new ExtentSparkReporter(reportFilePath);

                        sparkReporter.Config.ReportName = "Automation Report";
                        sparkReporter.Config.DocumentTitle = $"{applicationName} Execution Report";
                        sparkReporter.Config.Theme =
                            AventStack.ExtentReports.Reporter.Config.Theme.Standard;

                        _extentReports = new ExtentReports();
                        _extentReports.AttachReporter(sparkReporter);

                        // ── Machine & OS Info ──────────────────────────────────────
                        _extentReports.AddSystemInfo("Machine Name", Environment.MachineName);
                        _extentReports.AddSystemInfo("OS", RuntimeInformation.OSDescription);
                        _extentReports.AddSystemInfo("OS Architecture", RuntimeInformation.OSArchitecture.ToString());
                        _extentReports.AddSystemInfo("Current User", Environment.UserName);
                        _extentReports.AddSystemInfo("Processor Count", Environment.ProcessorCount.ToString());
                        _extentReports.AddSystemInfo(".NET Version", Environment.Version.ToString());

                        // ── Browser & Execution Info ───────────────────────────────
                        _extentReports.AddSystemInfo("Browser", automationSettings.Browser ?? "Not Specified");
                        _extentReports.AddSystemInfo("Headless Mode", automationSettings.Headless ? "Yes" : "No");
                        _extentReports.AddSystemInfo("Target Width", automationSettings.targetWidth.ToString());
                        _extentReports.AddSystemInfo("Target Height", automationSettings.targetHeight.ToString());
                    }
                }
            }

            return _extentReports;
        }

    }

    public static class ExtentTestManager
    {
        [ThreadStatic]
        private static ExtentTest _test;

        public static ExtentTest Test
        {
            get => _test;
            set => _test = value;
        }

    }
}

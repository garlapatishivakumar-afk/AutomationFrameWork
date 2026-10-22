using System;
using System.Linq;
using System.Text.RegularExpressions;
using Reqnroll;

namespace AutomationFrameWork.Helpers
{
    public static class TestCaseContext
    {
        public static string GetTestCaseId(ScenarioContext scenarioContext)
        {
            ArgumentNullException.ThrowIfNull(scenarioContext);

            var testCaseId = scenarioContext.ScenarioInfo.Tags.FirstOrDefault(tag =>
                tag != null && Regex.IsMatch(tag, @"\ATC[A-Za-z0-9_-]+\z", RegexOptions.CultureInvariant));

            if (testCaseId == null)
                throw new InvalidOperationException(
                    $"Scenario '{scenarioContext.ScenarioInfo.Title}' has no test case ID tag matching ^TC[A-Za-z0-9_-]+$. Add a tag such as @TC01.");

            return testCaseId;
        }
    }
}
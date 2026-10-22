using System;
using System.Collections.Generic;
using System.Linq;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace AutomationFrameWork
{
    public class ScenarioOrderer : ITestCaseOrderer
    {
        // Set desired scenario sequence by display name.
        private static readonly Dictionary<string, int> ScenarioPriority = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Open CMBS create order entry point"] = 1,
            ["Auto generated"] = 2,
            ["Update override details from deal report popup"] = 3
        };

        public IEnumerable<TTestCase> OrderTestCases<TTestCase>(IEnumerable<TTestCase> testCases)
            where TTestCase : ITestCase
        {
            return testCases
                .OrderBy(tc => GetPriority(tc.DisplayName))
                .ThenBy(tc => tc.DisplayName, StringComparer.OrdinalIgnoreCase);
        }

        private static int GetPriority(string displayName)
        {
            foreach (var kvp in ScenarioPriority)
            {
                if (displayName.Contains(kvp.Key, StringComparison.OrdinalIgnoreCase))
                {
                    return kvp.Value;
                }
            }

            return int.MaxValue;
        }
    }
}
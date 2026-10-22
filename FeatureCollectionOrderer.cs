using System;
using System.Collections.Generic;
using System.Linq;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace AutomationFrameWork
{
    public class FeatureCollectionOrderer : ITestCollectionOrderer
    {
        // Set desired feature execution sequence by generated feature class name.
        private static readonly Dictionary<string, int> FeaturePriority = new(StringComparer.OrdinalIgnoreCase)
        {
            ["InspectionsCreateOrderFeature"] = 1,
            ["LoginFeature"] = 2,
            ["DealsCompletionStatusFeature"] = 3
        };

        public IEnumerable<ITestCollection> OrderTestCollections(IEnumerable<ITestCollection> testCollections)
        {
            return testCollections
                .OrderBy(tc => GetPriority(tc.DisplayName))
                .ThenBy(tc => tc.DisplayName, StringComparer.OrdinalIgnoreCase);
        }

        private static int GetPriority(string displayName)
        {
            foreach (var kvp in FeaturePriority)
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
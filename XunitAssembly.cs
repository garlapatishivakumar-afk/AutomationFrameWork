using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]
[assembly: TestCollectionOrderer("AutomationFrameWork.FeatureCollectionOrderer", "AutomationFrameWork")]
[assembly: TestCaseOrderer("AutomationFrameWork.ScenarioOrderer", "AutomationFrameWork")]
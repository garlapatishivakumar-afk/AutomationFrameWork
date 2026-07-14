using AutomationFrameWork.Drivers;
using AutomationFrameWork.Pages;
using Microsoft.Playwright;

namespace AutomationFrameWork.Utilities
{
    /// <summary>
    /// Centralized test context for sharing objects across pages and steps.
    /// Includes IPage, CommonActionsPage, ScenarioContext, and FeatureContext.
    /// </summary>

    public class TestContext
    {
        public IPage Page { get; }
        public CommonActionsPage CommonActions { get; }
        public SmartLocators SmartActions { get; }
        public ScenarioContext ScenarioContext { get; }
        public FeatureContext FeatureContext { get; }
        public FileDataWriters DataWriters { get; }
        public PlaywrightDriver Driver { get; }

        public TestContext(IPage page, ScenarioContext scenarioContext, FeatureContext featureContext = null)
        {
            Page = page ?? throw new ArgumentNullException(nameof(page));
            ScenarioContext = scenarioContext ?? throw new ArgumentNullException(nameof(scenarioContext));
            FeatureContext = featureContext;
            CommonActions = new CommonActionsPage(Page);
            SmartActions = new SmartLocators();
            DataWriters = new FileDataWriters();
            Driver = new PlaywrightDriver(ScenarioContext);
        }
    }
}

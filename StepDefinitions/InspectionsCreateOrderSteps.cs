using AutomationFrameWork.Drivers;
using AutomationFrameWork.PageActions;
using AutomationFrameWork.Utilities;

namespace AutomationFrameWork.StepDefinitions
{
    [Binding]
    public class InspectionsCreateOrderSteps : BaseSteps
    {
        private readonly InspectionsCreateOrderPage _inspectionsCreateOrderPage;

        public InspectionsCreateOrderSteps(PlaywrightDriver playwrightDriver, ScenarioContext scenarioContext)
            : base(playwrightDriver, scenarioContext)
        {
            _inspectionsCreateOrderPage = new InspectionsCreateOrderPage(_driver.Page, _scenarioContext);
        }

        [Given("user navigates to inspections application")]
        public async Task GivenUserNavigatesToInspectionsApplication()
        {
            await _inspectionsCreateOrderPage.NavigateToInspectionsApplicationAsync();
        }

        [When("user opens CMBS module")]
        public async Task WhenUserOpensCmbsModule()
        {
            await _inspectionsCreateOrderPage.OpenCmbsModuleAsync();
        }

        [When("user opens create order page")]
        public async Task WhenUserOpensCreateOrderPage()
        {
            await _inspectionsCreateOrderPage.OpenCreateOrderPageAsync();
        }

        [Then("create order entry point should be visible")]
        public async Task ThenCreateOrderEntryPointShouldBeVisible()
        {
            await _inspectionsCreateOrderPage.VerifyCreateOrderEntryPointVisibleAsync();
        }
    }
}

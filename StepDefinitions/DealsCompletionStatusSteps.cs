using AutomationFrameWork.Drivers;
using AutomationFrameWork.PageActions;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;

namespace AutomationFrameWork.StepDefinitions
{
    [Binding]
    public class DealsCompletionStatusSteps : BaseSteps
    {
        private readonly DealsCompletionStatusPage _dealsCompletionStatusPage;

        public DealsCompletionStatusSteps(PlaywrightDriver playwrightDriver, ScenarioContext scenarioContext)
            : base(playwrightDriver, scenarioContext)
        {
            _dealsCompletionStatusPage = new DealsCompletionStatusPage(_driver.Page, _scenarioContext);
        }

        [Given("user navigates to investor reporting application")]
        public async Task GivenUserNavigatesToInvestorReportingApplication()
        {
            await _dealsCompletionStatusPage.NavigateToInvestorReportingAsync();
        }

        [When("user opens deals completion status page")]
        public async Task WhenUserOpensDealsCompletionStatusPage()
        {
            await _dealsCompletionStatusPage.OpenDealsCompletionStatusAsync();
        }

        [When("user opens the selected deal report")]
        public async Task WhenUserOpensTheSelectedDealReport()
        {
            await _dealsCompletionStatusPage.OpenSelectedDealReportAsync();
        }

        [When("user opens override popup for selected amount")]
        public async Task WhenUserOpensOverridePopupForSelectedAmount()
        {
            var popupPage = await _dealsCompletionStatusPage.OpenOverridePopupAsync();
            _scenarioContext["DealsCompletionPopup"] = popupPage;
        }

        [When("user updates override details with value (.*) and explanation (.*)")]
        public async Task WhenUserUpdatesOverrideDetailsWithValueAndExplanation(string overrideValue, string overrideExplanation)
        {
            var popupPage = _scenarioContext.Get<IPage>("DealsCompletionPopup");
            await _dealsCompletionStatusPage.UpdateOverrideDetailsAsync(popupPage, overrideValue, overrideExplanation);
        }

        [Then("user saves override changes")]
        public async Task ThenUserSavesOverrideChanges()
        {
            var popupPage = _scenarioContext.Get<IPage>("DealsCompletionPopup");
            await _dealsCompletionStatusPage.SaveOverrideChangesAsync(popupPage);
        }
    }
}

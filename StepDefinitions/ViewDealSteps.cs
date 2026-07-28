using AutomationFrameWork.Drivers;
using AutomationFrameWork.PageActions;
using AutomationFrameWork.Utilities;
using Reqnroll;

namespace AutomationFrameWork.StepDefinitions;

[Binding]
public class ViewDealSteps : BaseSteps
{
    private readonly ViewDealMethods methods;

    public ViewDealSteps(
        PlaywrightDriver playwrightDriver,
        ScenarioContext scenarioContext)
        : base(playwrightDriver, scenarioContext)
    {
        methods = new ViewDealMethods(playwrightDriver.Page);
    }

    [Given("user navigates to deals page")]
    public async Task GivenUserNavigatesToDealsPage()
    {
        await methods.NavigateToDealsPageAsync();
    }

    [When("user clicks on Deals Completion Status")]
    public async Task WhenUserClicksOnDealsCompletionStatus()
    {
        await methods.ClickDealsCompletionStatusAsync();
    }

    [When("user enters deal TID {string}")]
    public async Task WhenUserEntersDealTid(string dealTid)
    {
        await methods.EnterDealTidAsync(dealTid);
    }

    [When("user presses Enter to search")]
    public async Task WhenUserPressesEnterToSearch()
    {
        await methods.PressEnterToSearchAsync();
    }

    [When("user clicks on deal {string}")]
    public async Task WhenUserClicksOnDeal(string dealId)
    {
        await methods.ClickDealAsync(dealId);
    }

    [When("user checks report action checkboxes")]
    public async Task WhenUserChecksReportActionCheckboxes()
    {
        await methods.CheckReportActionCheckboxesAsync();
    }

    [When("user clicks view report link")]
    public async Task WhenUserClicksViewReportLink()
    {
        await methods.ClickViewReportLinkAsync();
    }

    [Then("user verifies deal report is displayed")]
    public async Task ThenUserVerifiesDealReportIsDisplayed()
    {
        await methods.VerifyDealReportIsDisplayedAsync();
    }

    [Then("user clicks complete action")]
    public async Task ThenUserClicksCompleteAction()
    {
        await methods.ClickCompleteActionAsync();
    }

    [Then("user closes the screen")]
    public async Task ThenUserClosesTheScreen()
    {
        await methods.CloseScreenAsync();
    }
}

using AutomationFrameWork.Drivers;
using AutomationFrameWork.PageActions;
using AutomationFrameWork.Utilities;
using Reqnroll;

namespace AutomationFrameWork.StepDefinitions;

[Binding]
public class ViewDashboardSteps : BaseSteps
{
    private readonly ViewDashboardMethods methods;

    public ViewDashboardSteps(
        PlaywrightDriver playwrightDriver,
        ScenarioContext scenarioContext)
        : base(playwrightDriver, scenarioContext)
    {
        methods = new ViewDashboardMethods(playwrightDriver.Page);
    }

    [Given("user navigates to document administration page")]
    public async Task GivenUserNavigatesToDocumentAdministrationPage()
    {
        await methods.NavigateToDocumentAdministrationAsync();
    }

    [When("user clicks on Administration link")]
    public async Task WhenUserClicksOnAdministrationLink()
    {
        await methods.ClickAdministrationLinkAsync();
    }

    [When("user clicks on Reassign Packages link")]
    public async Task WhenUserClicksOnReassignPackagesLink()
    {
        await methods.ClickReassignPackagesLinkAsync();
    }

    [When("user selects search user {string}")]
    public async Task WhenUserSelectsSearchUser(string userCode)
    {
        await methods.SelectSearchUserAsync(userCode);
    }

    [When("user clicks Search Queue button")]
    public async Task WhenUserClicksSearchQueueButton()
    {
        await methods.ClickSearchQueueAsync();
    }

    [When("user selects first package from queue")]
    public async Task WhenUserSelectsFirstPackageFromQueue()
    {
        await methods.SelectFirstPackageAsync();
    }

    [When("user selects assign user {string}")]
    public async Task WhenUserSelectsAssignUser(string userCode)
    {
        await methods.SelectAssignUserAsync(userCode);
    }

    [When("user clicks Assign to Selected User button")]
    public async Task WhenUserClicksAssignToSelectedUserButton()
    {
        await methods.ClickAssignToSelectedUserAsync();
    }

    [When("user clicks Dashboard link")]
    public async Task WhenUserClicksDashboardLink()
    {
        await methods.ClickDashboardLinkAsync();
    }

    [When("user navigates to default dashboard page")]
    public async Task WhenUserNavigatesToDefaultDashboardPage()
    {
        await methods.NavigateToDefaultDashboardAsync();
    }

    [When("user selects package source {string}")]
    public async Task WhenUserSelectsPackageSource(string packageSource)
    {
        await methods.SelectPackageSourceAsync(packageSource);
    }

    [Then("user re-navigates to default dashboard page")]
    public async Task ThenUserReNavigatesToDefaultDashboardPage()
    {
        await methods.NavigateToDefaultDashboardAsync();
    }
}
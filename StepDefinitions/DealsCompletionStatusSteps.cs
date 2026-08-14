using AutomationFrameWork.Drivers;
using AutomationFrameWork.PageActions;
using AutomationFrameWork.Utilities;
using Reqnroll;

namespace AutomationFrameWork.StepDefinitions;

[Binding]
public class DealsCompletionStatusSteps : BaseSteps
{
    private readonly DealsCompletionStatusMethods _methods;

    public DealsCompletionStatusSteps(PlaywrightDriver playwrightDriver, ScenarioContext scenarioContext)
        : base(playwrightDriver, scenarioContext)
    {
        var configReader = scenarioContext.Get<ConfigReader>("ConfigReader");
        _methods = new DealsCompletionStatusMethods(playwrightDriver.Page, configReader);
    }

    [Given("the user is on the deals completion status page")]
    public async Task GivenTheUserIsOnTheDealsCompletionStatusPage()
    {
        await _methods.OpenDealsCompletionStatusAsync();
    }

    [When("the user searches for transaction ID {string}")]
    public async Task WhenTheUserSearchesForTransactionId(string transactionId)
    {
        await _methods.SearchByTransactionIdAsync(transactionId);
    }

    [When("the user opens the deal report for transaction ID {string}")]
    public async Task WhenTheUserOpensTheDealReportForTransactionId(string transactionId)
    {
        await _methods.OpenDealReportAsync(transactionId);
    }

    [Then("the system should display no records for transaction ID {string}")]
    public async Task ThenTheSystemShouldDisplayNoRecordsForTransactionId(string transactionId)
    {
        await _methods.VerifyNoRecordsMessageAsync(transactionId);
    }

    [Then("the system should show the deal result for transaction ID {string}")]
    public async Task ThenTheSystemShouldShowTheDealResultForTransactionId(string transactionId)
    {
        await _methods.VerifyDealResultVisibleAsync(transactionId);
    }

    [Then("the system should display the transaction report for {string}")]
    public async Task ThenTheSystemShouldDisplayTheTransactionReportFor(string transactionId)
    {
        await _methods.VerifyTransactionReportVisibleAsync(transactionId);
    }
}

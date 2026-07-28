using AutomationFrameWork.Drivers;
using AutomationFrameWork.PageActions;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;
using Reqnroll;

namespace AutomationFrameWork.StepDefinitions;

[Binding]
public class ViewLoanReconciliationSteps : BaseSteps
{
    private readonly ViewLoanReconciliationMethods methods;
    private IPage? popupPage;

    public ViewLoanReconciliationSteps(
        PlaywrightDriver playwrightDriver,
        ScenarioContext scenarioContext)
        : base(playwrightDriver, scenarioContext)
    {
        methods = new ViewLoanReconciliationMethods(playwrightDriver.Page);
    }

    [Given("user navigates to WhoIam page")]
    public async Task GivenUserNavigatesToWhoIamPage()
    {
        await methods.NavigateToWhoIamAsync();
    }

    [When("user selects employee code {string}")]
    public async Task WhenUserSelectsEmployeeCode(string employeeCode)
    {
        await methods.SelectEmployeeCodeAsync(employeeCode);
    }

    [When("user runs as selected user")]
    public async Task WhenUserRunsAsSelectedUser()
    {
        await methods.RunAsUserAsync();
    }

    [When("user navigates to work queue page")]
    public async Task WhenUserNavigatesToWorkQueuePage()
    {
        await methods.NavigateToWorkQueueAsync();
    }

    [When("user opens Loan Mgmt and searches cash management account {string}")]
    public async Task WhenUserOpensLoanMgmtAndSearchesCashManagementAccount(string accountNumber)
    {
        await methods.OpenLoanMgmtAndSearchAccountAsync(accountNumber);
    }

    [When("user opens View Recon popup")]
    public async Task WhenUserOpensViewReconPopup()
    {
        popupPage = await methods.OpenViewReconPopupAsync();
    }

    [Then("user gets reconciliation from popup")]
    public async Task ThenUserGetsReconciliationFromPopup()
    {
        if (popupPage is null)
        {
            throw new InvalidOperationException("View Recon popup was not opened before Get Recon action.");
        }

        await methods.ClickGetReconAsync(popupPage);
    }
}

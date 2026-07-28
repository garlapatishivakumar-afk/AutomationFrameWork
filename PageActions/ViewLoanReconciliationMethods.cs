using AutomationFrameWork.PageElements;
using AutomationFrameWork.Pages;
using Microsoft.Extensions.Configuration;
using Microsoft.Playwright;
using static Microsoft.Playwright.Assertions;
using System.Text.RegularExpressions;

namespace AutomationFrameWork.PageActions;

public class ViewLoanReconciliationMethods
{
    private static readonly string BaseAppUrl = GetRequiredAppSetting("AppName");
    private static readonly string WhoIamPath = GetRequiredAppSetting("WhoIamPath");
    private static readonly string WorkQueuePath = GetRequiredAppSetting("WorkQueuePath");

    private readonly IPage page;
    private readonly ViewLoanReconciliationObjects objects;

    public ViewLoanReconciliationMethods(IPage page)
    {
        this.page = page;
        objects = new ViewLoanReconciliationObjects();
    }

    public async Task NavigateToWhoIamAsync()
    {
        await page.GotoAsync(BuildAppUrl(WhoIamPath));
        await WaitForExpectedPageAfterPotentialLoginAsync("Whoiam\\.aspx");
    }

    public async Task SelectEmployeeCodeAsync(string employeeCode)
    {
        await page.Locator(ViewLoanReconciliationObjects.EmployeeDropdownSelector).SelectOptionAsync(employeeCode);
    }

    public async Task RunAsUserAsync()
    {
        await objects.RunAsUserButton(page).ClickAsync();
    }

    public async Task NavigateToWorkQueueAsync()
    {
        await page.GotoAsync(BuildAppUrl(WorkQueuePath));
        await WaitForExpectedPageAfterPotentialLoginAsync("dgWorkQueue\\.aspx");
    }

    public async Task OpenLoanMgmtAndSearchAccountAsync(string accountNumber)
    {
        await objects.LoanMgmtLink(page).ClickAsync();
        await objects.CashMgmtAccountTextbox(page).ClickAsync();
        await objects.CashMgmtAccountTextbox(page).FillAsync(accountNumber);
        await objects.SearchButton(page).ClickAsync();
    }

    public async Task<IPage> OpenViewReconPopupAsync()
    {
        Task<IPage> popupTask = page.WaitForPopupAsync();
        await objects.ViewReconLink(page).ClickAsync();

        IPage popupPage = await popupTask;
        await popupPage.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
        await Expect(objects.GetReconButton(popupPage)).ToBeVisibleAsync();

        return popupPage;
    }

    public async Task ClickGetReconAsync(IPage popupPage)
    {
        await objects.GetReconButton(popupPage).ClickAsync();
        await Expect(objects.GetReconButton(popupPage)).ToBeVisibleAsync();
    }

    private async Task WaitForExpectedPageAfterPotentialLoginAsync(string expectedUrlPattern)
    {
        string currentUrl = page.Url ?? string.Empty;

        if (currentUrl.Contains("login.microsoftonline.com", StringComparison.OrdinalIgnoreCase)
            || currentUrl.Contains("/signin", StringComparison.OrdinalIgnoreCase)
            || currentUrl.Contains("/login", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine("Authentication page detected. Waiting for manual sign-in to complete...");
        }

        try
        {
            await Expect(page).ToHaveURLAsync(new Regex(expectedUrlPattern, RegexOptions.IgnoreCase), new()
            {
                Timeout = 180000
            });
        }
        catch (PlaywrightException ex)
        {
            throw new InvalidOperationException(
                "Unable to reach target application page. If redirected to identity provider, complete sign-in and rerun.",
                ex);
        }
    }

    private static string BuildAppUrl(string relativePath)
    {
        return $"{BaseAppUrl}/{relativePath.TrimStart('/')}";
    }

    private static string GetRequiredAppSetting(string key)
    {
        var projectRoot = CommonActionsPage.GetProjectRoot();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(projectRoot)
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        var settingValue = configuration[$"Urls:Applications:{key}"];
        if (string.IsNullOrWhiteSpace(settingValue))
        {
            throw new InvalidOperationException($"Missing Urls:Applications:{key} in appsettings.json.");
        }

        return key.Equals("AppName", StringComparison.OrdinalIgnoreCase)
            ? settingValue.TrimEnd('/')
            : settingValue;
    }
}

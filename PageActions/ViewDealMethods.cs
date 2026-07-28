using AutomationFrameWork.PageElements;
using AutomationFrameWork.Pages;
using Microsoft.Extensions.Configuration;
using Microsoft.Playwright;
using static Microsoft.Playwright.Assertions;
using System.Text.RegularExpressions;

namespace AutomationFrameWork.PageActions;

public class ViewDealMethods
{
    private static readonly string BaseAppUrl = GetRequiredAppSetting("AppName");
    private static readonly string DefaultPath = "default.aspx";

    private readonly IPage page;
    private readonly ViewDealObjects objects;

    public ViewDealMethods(IPage page)
    {
        this.page = page;
        objects = new ViewDealObjects();
    }

    public async Task NavigateToDealsPageAsync()
    {
        string dealsUrl = BuildAppUrl(DefaultPath);
        await page.GotoAsync(dealsUrl);
        await WaitForPageLoadAsync("default\\.aspx");
    }

    public async Task ClickDealsCompletionStatusAsync()
    {
        await objects.DealsCompletionStatusLink(page).ClickAsync();
        await WaitForPageLoadAsync("DealsCompletionStatus\\.aspx");
    }

    public async Task EnterDealTidAsync(string dealTid)
    {
        var tidField = objects.TidInputField(page);
        await tidField.ClickAsync();
        await tidField.FillAsync(dealTid);
    }

    public async Task PressEnterToSearchAsync()
    {
        await objects.TidInputField(page).PressAsync("Enter");
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task ClickDealAsync(string dealId)
    {
        await objects.DealLink(page, dealId).ClickAsync();
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task CheckReportActionCheckboxesAsync()
    {
        await objects.FirstReportCheckbox(page).CheckAsync();
        await objects.SecondReportCheckbox(page).CheckAsync();
    }

    public async Task ClickViewReportLinkAsync()
    {
        Task<IPage> popupTask = page.WaitForPopupAsync();
        await objects.ViewReportLink(page).ClickAsync();
        
        IPage reportPage = await popupTask;
        await reportPage.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
    }

    public async Task VerifyDealReportIsDisplayedAsync()
    {
        await Expect(page).ToHaveURLAsync(new Regex("DealReportDetailNew\\.aspx", RegexOptions.IgnoreCase));
    }

    public async Task ClickCompleteActionAsync()
    {
        await objects.CompleteLink(page).ClickAsync();
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task CloseScreenAsync()
    {
        await objects.CloseScreenButton(page).ClickAsync();
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    private async Task WaitForPageLoadAsync(string expectedUrlPattern)
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

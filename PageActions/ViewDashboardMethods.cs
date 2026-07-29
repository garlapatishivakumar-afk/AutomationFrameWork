using AutomationFrameWork.PageElements;
using AutomationFrameWork.Pages;
using Microsoft.Extensions.Configuration;
using Microsoft.Playwright;
using System.Text.RegularExpressions;
using static Microsoft.Playwright.Assertions;

namespace AutomationFrameWork.PageActions;

public class ViewDashboardMethods
{
    private static readonly string DocAdminUrl = GetRequiredAppSetting("DocAdmin").TrimEnd('/');
    private static readonly string DefaultDashboardUrl = GetRequiredAppSetting("RecordedUrl6");

    private readonly IPage page;
    private readonly ViewDashboardObjects objects;

    public ViewDashboardMethods(IPage page)
    {
        this.page = page;
        objects = new ViewDashboardObjects();
    }

    public async Task NavigateToDocumentAdministrationAsync()
    {
        await page.GotoAsync(DocAdminUrl);
        await WaitForExpectedUrlAfterPotentialLoginAsync("documentadministration-uat\\.trimont\\.com");
    }

    public async Task ClickAdministrationLinkAsync()
    {
        await objects.AdministrationLink(page).ClickAsync();
        await Expect(objects.ReassignPackagesLink(page)).ToBeVisibleAsync();
    }

    public async Task ClickReassignPackagesLinkAsync()
    {
        await objects.ReassignPackagesLink(page).ClickAsync();
        await Expect(objects.SearchUserDropdown(page)).ToBeVisibleAsync();
    }

    public async Task SelectSearchUserAsync(string userCode)
    {
        await objects.SearchUserDropdown(page).SelectOptionAsync(userCode);
    }

    public async Task ClickSearchQueueAsync()
    {
        await objects.SearchQueueButton(page).ClickAsync();
        await Expect(objects.FirstPackageCheckbox(page)).ToBeVisibleAsync();
    }

    public async Task SelectFirstPackageAsync()
    {
        await objects.FirstPackageCheckbox(page).CheckAsync();
    }

    public async Task SelectAssignUserAsync(string userCode)
    {
        await objects.AssignUserDropdown(page).SelectOptionAsync(userCode);
    }

    public async Task ClickAssignToSelectedUserAsync()
    {
        await objects.AssignToSelectedUserButton(page).ClickAsync();
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
        await Expect(objects.DashboardLink(page)).ToBeVisibleAsync();
    }

    public async Task ClickDashboardLinkAsync()
    {
        await objects.DashboardLink(page).ClickAsync();
        await WaitForExpectedUrlAfterPotentialLoginAsync("Default\\.aspx");
    }

    public async Task NavigateToDefaultDashboardAsync()
    {
        await page.GotoAsync(DefaultDashboardUrl);
        await WaitForExpectedUrlAfterPotentialLoginAsync("Default\\.aspx");
    }

    public async Task SelectPackageSourceAsync(string packageSource)
    {
        await objects.PackageSourceDropdown(page).SelectOptionAsync(packageSource);
    }

    private async Task WaitForExpectedUrlAfterPotentialLoginAsync(string expectedUrlPattern)
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

        return settingValue;
    }
}
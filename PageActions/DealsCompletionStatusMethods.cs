using AutomationFrameWork.PageElements;
using AutomationFrameWork.Pages;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;

namespace AutomationFrameWork.PageActions;

public class DealsCompletionStatusMethods
{
    private readonly IPage _page;
    private readonly ConfigReader _configReader;
    private readonly DealsCompletionStatusObjects _objects;
    private readonly CommonActionsPage _commonActionsPage;

    public DealsCompletionStatusMethods(IPage page, ConfigReader configReader)
    {
        _page = page ?? throw new ArgumentNullException(nameof(page));
        _configReader = configReader ?? throw new ArgumentNullException(nameof(configReader));
        _objects = new DealsCompletionStatusObjects(page);
        _commonActionsPage = new CommonActionsPage(page);
    }

    public async Task OpenDealsCompletionStatusAsync()
    {
        var statusUrl = _configReader.Urls?.TryGetApplication("DealsCompletionStatus");
        if (!string.IsNullOrWhiteSpace(statusUrl))
        {
            await _page.GotoAsync(statusUrl);
            return;
        }

        var investorReportingUrl = _configReader.Urls?.TryGetApplication("InvestorReporting");
        if (string.IsNullOrWhiteSpace(investorReportingUrl))
        {
            throw new InvalidOperationException("InvestorReporting URL is missing from appsettings.json.");
        }

        await _page.GotoAsync(investorReportingUrl);
        await _objects.DealsMenuLink.ClickAsync();
        await _objects.DealsCompletionStatusLink.ClickAsync();
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task SearchByTransactionIdAsync(string transactionId)
    {
        if (string.IsNullOrWhiteSpace(transactionId))
        {
            throw new ArgumentException("Transaction ID cannot be empty.", nameof(transactionId));
        }

        await _objects.TransactionIdInput.FillAsync(transactionId);
        await _objects.TransactionIdInput.PressAsync("Enter");
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task VerifyNoRecordsMessageAsync(string transactionId)
    {
        _ = transactionId;
        await _objects.NoRecordsMessage.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 20000 });
        var text = await _objects.NoRecordsMessage.InnerTextAsync();
        if (!text.Contains("No records to display.", StringComparison.OrdinalIgnoreCase))
        {
            throw new Exception($"Expected 'No records to display.' but found '{text}'.");
        }
    }

    public async Task VerifyDealResultVisibleAsync(string transactionId)
    {
        var normalized = transactionId.Trim();
        await _objects.DealLink(normalized).WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 20000 });
    }

    public async Task OpenDealReportAsync(string transactionId)
    {
        var normalized = transactionId.Trim();
        var dealLink = _objects.DealLink(normalized);
        await dealLink.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 20000 });
        await dealLink.ClickAsync();
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task VerifyTransactionReportVisibleAsync(string transactionId)
    {
        var normalized = transactionId.Trim();
        await _objects.TransactionReportText(normalized).WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 20000 });
    }
}

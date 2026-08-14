using Microsoft.Playwright;

namespace AutomationFrameWork.PageElements;

public class DealsCompletionStatusObjects
{
    private readonly IPage _page;

    public DealsCompletionStatusObjects(IPage page)
    {
        _page = page;
    }

    public ILocator DealsMenuLink => _page.GetByRole(AriaRole.Link, new() { Name = "Deals" });
    public ILocator DealsCompletionStatusLink => _page.GetByRole(AriaRole.Link, new() { Name = "Deals Completion Status" });
    public ILocator TransactionIdInput => _page.Locator("input[name='ctl00$cp1$txtTID']");
    public ILocator NoRecordsMessage => _page.GetByText("No records to display.");
    public ILocator DealLink(string transactionId) => _page.GetByRole(AriaRole.Link, new() { Name = transactionId, Exact = true });
    public ILocator TransactionReportText(string transactionId) => _page.GetByText($"Transaction: {transactionId} (");
}

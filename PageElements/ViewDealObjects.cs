using Microsoft.Playwright;

namespace AutomationFrameWork.PageElements;

public class ViewDealObjects
{
    // Navigation and main page elements
    public ILocator DealsLink(IPage page) => page.GetByRole(AriaRole.Link, new() { Name = "Deals", NameRegex = new System.Text.RegularExpressions.Regex("^Deals$") });
    public ILocator DealsCompletionStatusLink(IPage page) => page.GetByRole(AriaRole.Link, new() { Name = "Deals Completion Status" });

    // Deal completion status page elements
    public ILocator TidInputField(IPage page) => page.Locator("input[name=\"ctl00$cp1$txtTID\"]");
    public ILocator DealLink(IPage page, string dealId) => page.GetByRole(AriaRole.Link, new() { Name = dealId });
    
    // Report selection elements
    public ILocator FirstReportCheckbox(IPage page) => page.Locator("#ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl05_chAction");
    public ILocator SecondReportCheckbox(IPage page) => page.Locator("#ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl07_chAction");
    public ILocator ViewReportLink(IPage page) => page.Locator("#ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl05_lnkView");

    // Deal report detail page elements
    public ILocator CompleteLink(IPage page) => page.GetByRole(AriaRole.Link, new() { Name = "complete", NameRegex = new System.Text.RegularExpressions.Regex("^complete$") });
    public ILocator CloseScreenButton(IPage page) => page.GetByRole(AriaRole.Button, new() { Name = "close screen" });
}

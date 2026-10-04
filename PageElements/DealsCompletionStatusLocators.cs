using Microsoft.Playwright;

namespace AutomationFrameWork.PageElements
{
    public class DealsCompletionStatusLocators
    {
        public ILocator DealsLink(IPage page) =>
            page.GetByRole(AriaRole.Link, new() { Name = "Deals", Exact = true });

        public ILocator DealsCompletionStatusLink(IPage page) =>
            page.GetByRole(AriaRole.Link, new() { Name = "Deals Completion Status" });

        public ILocator DealRowLink(IPage page) =>
            page.Locator("//tr[@id='ctl00_cp1_gd_ctl00__8']//td[2]/a");

        public ILocator ViewReportLink(IPage page) =>
            page.Locator("//a[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl14_lnkView']");

        public ILocator OverrideAmountLink(IPage page) =>
            page.Locator("#g_ctl02_hE_4");

        public ILocator FieldValueLabel(IPage popupPage) =>
            popupPage.GetByText("Field Value:");

        public ILocator OverrideValueInput(IPage popupPage) =>
            popupPage.Locator("#txtOverrideValue");

        public ILocator OverrideRuleInput(IPage popupPage) =>
            popupPage.Locator("#txtOverrideRule");

        public ILocator OverrideExplanationInput(IPage popupPage) =>
            popupPage.Locator("#txtOverrideExplan");

        public ILocator OkButton(IPage popupPage) =>
            popupPage.GetByRole(AriaRole.Button, new() { Name = "OK" });
    }
}

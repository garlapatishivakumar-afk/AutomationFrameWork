using System;
using System.Threading.Tasks;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;
using AutomationFrameWork.Pages;

namespace AutomationFrameWork.CodegenAI
{
    public sealed class CodegenRecordedFlow
    {
        private readonly CommonActionsPage _commonActions;

        private IPage _page1 = default!;

        public CodegenRecordedFlow(IPage page, ConfigReader config)
        {
            Page = page ?? throw new ArgumentNullException(nameof(page));
            Config = config ?? throw new ArgumentNullException(nameof(config));
            _commonActions = new CommonActionsPage(Page);
        }

        public IPage Page { get; }

        public ConfigReader Config { get; }

        // Locators
        public ILocator Deals => Page.GetByRole(AriaRole.Link, new() { Name = "Deals", Exact = true });
        public ILocator DealsCompletionStatus => Page.GetByRole(AriaRole.Link, new() { Name = "Deals Completion Status" });
        public ILocator TrIDCp1GdTdA => Page.Locator("//tr[@id='ctl00_cp1_gd_ctl00__8']//td[2]/a");
        public ILocator AidRgrdReportsLnkView => Page.Locator("//a[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl14_lnkView']");
        public ILocator Aidghe => Page.Locator("//a[@id='g_ctl02_hE_4']");
        public ILocator FieldValue => _page1.GetByText("Field Value:");
        public ILocator OverrideValue => _page1.Locator("#txtOverrideValue");
        public ILocator OverrideRule => _page1.Locator("#txtOverrideRule");
        public ILocator OverrideExplan => _page1.Locator("#txtOverrideExplan");
        public ILocator Ok => _page1.GetByRole(AriaRole.Button, new() { Name = "OK" });

        public async Task ReplayAsync()
        {
            // Review: URL at source line uses literal value because no matching appsettings Urls entry was found: https://investorreporting-mb-sit.trimont.com/default.aspx
            await _commonActions.NavigateToURLAsync("https://investorreporting-mb-sit.trimont.com/default.aspx");
            await Deals.ClickAsync();
            await DealsCompletionStatus.ClickAsync();
            await TrIDCp1GdTdA.ClickAsync();
            await AidRgrdReportsLnkView.ClickAsync();
            var page1Promise = Page.WaitForPopupAsync();
            await Aidghe.ClickAsync();
            _page1 = await page1Promise;
            await FieldValue.ClickAsync();
            await OverrideValue.ClickAsync();
            // Review: Literal input value preserved from recording. Consider replacing with framework data binding.
            await OverrideValue.FillAsync("1324");
            await OverrideRule.ClickAsync();
            await OverrideRule.ClickAsync();
            await OverrideRule.ClickAsync();
            await OverrideExplan.ClickAsync();
            // Review: Literal input value preserved from recording. Consider replacing with framework data binding.
            await OverrideExplan.FillAsync("test");
            await Ok.ClickAsync();
        }
    }
}
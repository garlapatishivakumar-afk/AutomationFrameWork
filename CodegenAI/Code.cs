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
        public ILocator InputIDCp1GdChRoll => Page.Locator("//input[@id='ctl00_cp1_gd_ctl00_ctl18_chRoll']");
        public ILocator TableIDMaingridTrSpanClassRbTextSpanClassRbText => Page.Locator("//table[@id='maingrid']//tr[.//span[@class='rbText']]//span[@class='rbText']");
        public ILocator Ok => Page.GetByRole(AriaRole.Link, new() { Name = "OK" });
        public ILocator TrIDCp1GdTdA => Page.Locator("//tr[@id='ctl00_cp1_gd_ctl00__8']//td[2]/a");
        public ILocator InputIDRgrdReportsChAction => Page.Locator("//input[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl14_chAction']");
        public ILocator InputIDRgrdReportsChAction2 => Page.Locator("//input[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl16_chAction']");
        public ILocator InputIDRgrdReportsChAction3 => Page.Locator("//input[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl18_chAction']");
        public ILocator InputIDRgrdReportsChAction4 => Page.Locator("//input[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl20_chAction']");
        public ILocator AidGenerating => Page.Locator("//a[@id='ctl00_ContentPlaceHolder1_2_generating']");
        public ILocator InputIDBtnOk => Page.Locator("//input[@id='ctl00_ContentPlaceHolder1_btnOk']");
        public ILocator AidRgrdReportsLnkView => Page.Locator("//a[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl14_lnkView']");
        public ILocator Aidghe => Page.Locator("//a[@id='g_ctl03_hE_4']");
        public ILocator EffectiveFrom => _page1.GetByText("Effective From:");
        public ILocator EffectiveTo => _page1.GetByText("Effective To:");
        public ILocator FieldName => _page1.GetByText("Field Name:");
        public ILocator FieldValue => _page1.GetByText("Field Value:");
        public ILocator OverrideValue => _page1.GetByText("Override Value:");

        public async Task ReplayAsync()
        {
            await NavigateToInvestorReportingAsync();
            await OpenDealsCompletionStatusAsync();
            await OpenSelectedDealReportAsync();
            var popupPage = await OpenOverridePopupAsync();
            await UpdateOverrideDetailsAsync(popupPage);
        }

        public async Task NavigateToInvestorReportingAsync()
        {
            await _commonActions.NavigateToURLAsync(Config.Urls.TryGetApplication("InvestorReporting"));
        }

        public async Task OpenDealsCompletionStatusAsync()
        {
            await Deals.ClickAsync();
            await DealsCompletionStatus.ClickAsync();
            await Assertions.Expect(Page).ToHaveURLAsync(new System.Text.RegularExpressions.Regex("DealsCompletionStatus\\.aspx", System.Text.RegularExpressions.RegexOptions.IgnoreCase));
        }

        public async Task OpenSelectedDealReportAsync()
        {
            await InputIDCp1GdChRoll.CheckAsync();
            await TableIDMaingridTrSpanClassRbTextSpanClassRbText.ClickAsync();
            await Ok.ClickAsync();
            await TrIDCp1GdTdA.ClickAsync();
            await InputIDRgrdReportsChAction.CheckAsync();
            await InputIDRgrdReportsChAction2.CheckAsync();
            await InputIDRgrdReportsChAction3.CheckAsync();
            await InputIDRgrdReportsChAction4.CheckAsync();
            await AidGenerating.ClickAsync();
            await InputIDBtnOk.ClickAsync();
            await AidRgrdReportsLnkView.ClickAsync();
        }

        public async Task<IPage> OpenOverridePopupAsync()
        {
            var page1Promise = Page.WaitForPopupAsync();
            await Aidghe.ClickAsync();
            _page1 = await page1Promise;
            await _page1.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            await Assertions.Expect(EffectiveFrom).ToBeVisibleAsync();
            return _page1;
        }

        public async Task UpdateOverrideDetailsAsync(IPage popupPage)
        {
            await EffectiveFrom.ClickAsync();
            await EffectiveTo.ClickAsync();
            await FieldName.ClickAsync();
            await FieldValue.ClickAsync();
            await OverrideValue.ClickAsync();
        }
    }
}
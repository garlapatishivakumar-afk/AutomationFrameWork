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
        public ILocator TrIDCp1GdTd => Page.Locator("//tr[@id='ctl00_cp1_gd_ctl00__5']//td[8]");
        public ILocator TrIDCp1GdTd2 => Page.Locator("//tr[@id='ctl00_cp1_gd_ctl00__5']//td[6]");
        public ILocator TrIDCp1GdInputNameCp1GdChRoll => Page.Locator("//tr[@id='ctl00_cp1_gd_ctl00__7']//input[@name='ctl00$cp1$gd$ctl00$ctl18$chRoll']");
        public ILocator NextPage => Page.GetByRole(AriaRole.Button, new() { Name = "Next Page" });
        public ILocator TrIDCp1GdTdA => Page.Locator("//tr[@id='ctl00_cp1_gd_ctl00__9']//td[2]/a");
        public ILocator TrIDRgrdReportsTdA => Page.Locator("//tr[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00__1']//td[3]/a");
        public ILocator Aidghe => Page.Locator("//a[@id='g_ctl08_hE_4']");
        public ILocator Aidghe2 => Page.Locator("//a[@id='g_ctl08_hE_5']");
        public ILocator Aidghe3 => Page.Locator("//a[@id='g_ctl08_hE_6']");
        public ILocator Aidghe4 => Page.Locator("//a[@id='g_ctl08_hE_31']");
        public ILocator Aidghe5 => Page.Locator("//a[@id='g_ctl08_hE_42']");
        public ILocator Aidghe6 => Page.Locator("//a[@id='g_ctl08_hE_58']");

        public async Task ReplayAsync()
        {
            // Review: URL at source line uses literal value because no matching appsettings Urls entry was found: https://investorreporting-mb-sit.trimont.com/default.aspx
            await _commonActions.NavigateToURLAsync("https://investorreporting-mb-sit.trimont.com/default.aspx");
            await Deals.ClickAsync();
            await DealsCompletionStatus.ClickAsync();
            await TrIDCp1GdTd.ClickAsync();
            await TrIDCp1GdTd2.ClickAsync();
            await TrIDCp1GdInputNameCp1GdChRoll.CheckAsync();
            await NextPage.ClickAsync();
            await TrIDCp1GdTdA.ClickAsync();
            await TrIDRgrdReportsTdA.ClickAsync();
            await Aidghe.ClickAsync();
            await Aidghe2.ClickAsync();
            await Aidghe3.ClickAsync();
            await Aidghe4.ClickAsync();
            await Aidghe5.ClickAsync();
            await Aidghe6.ClickAsync();
        }
    }
}
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
        public ILocator Cmbs => Page.GetByRole(AriaRole.Link, new() { Name = "CMBS" });
        public ILocator Exceptions => Page.GetByRole(AriaRole.Link, new() { Name = "Exceptions" });
        public ILocator AidRadGridInspectionExceptionsLnkExceptionsReport => Page.Locator("//a[@id='ctl00_ContentPlaceHolder1_RadGridInspectionExceptions_ctl00_ctl02_ctl00_lnkExceptionsReport']");
        public ILocator Refresh => _page1.FrameLocator("iframe').contentFrame().locator('iframe").GetByRole(AriaRole.Button, new() { Name = "Refresh" });
        public ILocator IframeContentFrameGetByTestIDToolbarExportDropdown => _page1.FrameLocator("iframe").Locator("iframe').contentFrame().getByTestId('toolbar-export-dropdown");
        public ILocator IframeContentFrameGetByTestIDExportXlsxBtn => _page1.FrameLocator("iframe").Locator("iframe').contentFrame().getByTestId('export-xlsx-btn");

        public async Task ReplayAsync()
        {
            await NavigateToApplicationAsync();
            await ExecutePrePopupActionsAsync();
            var popupPage = await OpenOverridePopupAsync();
            await UpdateOverrideDetailsAsync(popupPage);
        }

        public async Task NavigateToApplicationAsync()
        {
            // Review: URL at source line uses literal value because no matching appsettings Urls entry was found: https://inspections-dev.trimont.com/default.aspx
            await _commonActions.NavigateToURLAsync("https://inspections-dev.trimont.com/default.aspx");
            await Page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
        }

        public async Task ExecutePrePopupActionsAsync()
        {
            await Cmbs.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await Cmbs.ClickAsync();
            await Exceptions.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await Exceptions.ClickAsync();
        }

        public async Task<IPage> OpenOverridePopupAsync()
        {
            var page1Promise = Page.WaitForPopupAsync();
            await AidRadGridInspectionExceptionsLnkExceptionsReport.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await AidRadGridInspectionExceptionsLnkExceptionsReport.ClickAsync();
            _page1 = await page1Promise;
            await _page1.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            await Refresh.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            return _page1;
        }

        public async Task UpdateOverrideDetailsAsync(IPage popupPage)
        {
            await Refresh.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await Refresh.ClickAsync();
            await Refresh.ClickAsync();
            await IframeContentFrameGetByTestIDToolbarExportDropdown.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await IframeContentFrameGetByTestIDToolbarExportDropdown.ClickAsync();
            var download = await _page1.RunAndWaitForDownloadAsync(async () =>
            {
                await IframeContentFrameGetByTestIDExportXlsxBtn.ClickAsync();
            });
        }
    }
}
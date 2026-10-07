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
        public ILocator Search2 => Page.GetByRole(AriaRole.Link, new() { Name = "Search" }).Nth(1);
        public ILocator NewSearchControl1TxtSearchValue => Page.Locator("#ctl00_ContentPlaceHolder1_NewSearchControl1_txtSearchValue");
        public ILocator Search => Page.GetByRole(AriaRole.Button, new() { Name = "Search" });
        public ILocator Locator310929478 => Page.GetByRole(AriaRole.Cell, new() { Name = "310929478", Exact = true });

        public async Task ReplayAsync()
        {
            await NavigateToApplicationAsync();
            await OpenTargetModuleAsync();
            await ApplySearchCriteriaAsync();
        }

        public async Task NavigateToApplicationAsync()
        {
            // Review: URL at source line uses literal value because no matching appsettings Urls entry was found: https://inspections-sit.trimont.com/default.aspx
            await _commonActions.NavigateToURLAsync("https://inspections-sit.trimont.com/default.aspx");
            await Page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
        }

        public async Task OpenTargetModuleAsync()
        {
            await Search2.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await Search2.ClickAsync();
            await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await NewSearchControl1TxtSearchValue.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await NewSearchControl1TxtSearchValue.ClickAsync();
            await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);
        }

        public async Task ApplySearchCriteriaAsync()
        {
            // Review: Literal input value preserved from recording. Consider replacing with framework data binding.
            await NewSearchControl1TxtSearchValue.FillAsync("6678");
            await Search.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await Search.ClickAsync();
            await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await Locator310929478.WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await Locator310929478.ClickAsync();
        }
    }
}
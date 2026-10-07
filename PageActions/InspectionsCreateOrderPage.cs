using AutomationFrameWork.PageElements;
using AutomationFrameWork.Pages;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;
using static Microsoft.Playwright.Assertions;

namespace AutomationFrameWork.PageActions
{
    public class InspectionsCreateOrderPage
    {
        private readonly IPage _page;
        private readonly ScenarioContext _scenarioContext;
        private readonly CommonActionsPage _commonActions;
        private readonly InspectionsCreateOrderLocators _locators;

        public InspectionsCreateOrderPage(IPage page, ScenarioContext scenarioContext)
        {
            _page = page;
            _scenarioContext = scenarioContext;
            _commonActions = new CommonActionsPage(page);
            _locators = new InspectionsCreateOrderLocators();
        }

        public async Task NavigateToInspectionsApplicationAsync()
        {
            var config = _scenarioContext.Get<ConfigReader>("ConfigReader");
            var url = config.Urls?.TryGetApplication("InspectionsServerErrorDefault");

            if (string.IsNullOrWhiteSpace(url))
                throw new InvalidOperationException("Missing Urls:Applications:InspectionsServerErrorDefault in appsettings.json.");

            await _commonActions.NavigateToURLAsync(url);
            await _page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
        }

        public async Task OpenCmbsModuleAsync()
        {
            await _locators.CmbsLink(_page).WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await _locators.CmbsLink(_page).ClickAsync();
        }

        public async Task OpenCreateOrderPageAsync()
        {
            await _locators.CreateOrderLink(_page).WaitForAsync(new() { State = WaitForSelectorState.Visible });
            await _locators.CreateOrderLink(_page).ClickAsync();
            await _page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
        }

        public async Task VerifyCreateOrderEntryPointVisibleAsync()
        {
            await Expect(_locators.CreateOrderLink(_page)).ToBeVisibleAsync();
        }
    }
}

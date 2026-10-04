using AutomationFrameWork.PageElements;
using AutomationFrameWork.Pages;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;
using static Microsoft.Playwright.Assertions;
using System.Text.RegularExpressions;

namespace AutomationFrameWork.PageActions
{
    public class DealsCompletionStatusPage
    {
        private readonly IPage _page;
        private readonly ScenarioContext _scenarioContext;
        private readonly CommonActionsPage _commonActions;
        private readonly DealsCompletionStatusLocators _locators;

        public DealsCompletionStatusPage(IPage page, ScenarioContext scenarioContext)
        {
            _page = page;
            _scenarioContext = scenarioContext;
            _commonActions = new CommonActionsPage(page);
            _locators = new DealsCompletionStatusLocators();
        }

        public async Task NavigateToInvestorReportingAsync()
        {
            var config = _scenarioContext.Get<ConfigReader>("ConfigReader");
            var url = config.Urls?.TryGetApplication("InvestorReporting");

            if (string.IsNullOrWhiteSpace(url))
                throw new InvalidOperationException("Missing Urls:Applications:InvestorReporting in appsettings.json.");

            await _commonActions.NavigateToURLAsync(url);
            await Expect(_page).ToHaveURLAsync(new Regex("investorreporting-mb-sit\\.trimont\\.com", RegexOptions.IgnoreCase));
        }

        public async Task OpenDealsCompletionStatusAsync()
        {
            await _locators.DealsLink(_page).ClickAsync();
            await _locators.DealsCompletionStatusLink(_page).ClickAsync();
            await Expect(_page).ToHaveURLAsync(new Regex("DealsCompletionStatus\\.aspx", RegexOptions.IgnoreCase));
        }

        public async Task OpenSelectedDealReportAsync()
        {
            await _locators.DealRowLink(_page).ClickAsync();
            await _locators.ViewReportLink(_page).ClickAsync();
        }

        public async Task<IPage> OpenOverridePopupAsync()
        {
            var popupTask = _page.WaitForPopupAsync();
            await _locators.OverrideAmountLink(_page).ClickAsync();
            var popupPage = await popupTask;
            await popupPage.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            await Expect(_locators.OverrideValueInput(popupPage)).ToBeVisibleAsync();
            return popupPage;
        }

        public async Task UpdateOverrideDetailsAsync(IPage popupPage, string overrideValue, string overrideExplanation)
        {
            await _locators.FieldValueLabel(popupPage).ClickAsync();
            await FillInputAsync(_locators.OverrideValueInput(popupPage), overrideValue);

            await _locators.OverrideRuleInput(popupPage).ClickAsync();
            await _locators.OverrideRuleInput(popupPage).ClickAsync();
            await _locators.OverrideRuleInput(popupPage).ClickAsync();

            await FillInputAsync(_locators.OverrideExplanationInput(popupPage), overrideExplanation);
        }

        public async Task SaveOverrideChangesAsync(IPage popupPage)
        {
            await _locators.OkButton(popupPage).ClickAsync();
            await popupPage.WaitForLoadStateAsync(LoadState.NetworkIdle);
        }

        private static async Task FillInputAsync(ILocator input, string value)
        {
            await input.ClickAsync();
            await input.FillAsync(value);
            await Expect(input).ToHaveValueAsync(value);
        }
    }
}

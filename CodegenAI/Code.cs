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
        public ILocator ExternalWires => Page.GetByRole(AriaRole.Link, new() { Name = "External Wires" });
        public ILocator CreateExternalWire => Page.GetByRole(AriaRole.Link, new() { Name = "Create External Wire" });
        public ILocator CmgTab1DetailTabPageWfwcInternalWireDetailTxtAmount => Page.FrameLocator("iframe[name=\"rwExternalWire\"]").Locator("#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail_ctl00_txtAmount");
        public ILocator CmgTab1DetailTabPageWfwcInternalWireDetail2CmbRepetitiveCodeInput => Page.FrameLocator("iframe[name=\"rwExternalWire\"]").Locator("#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbRepetitiveCode_Input");
        public ILocator Dolp733Propertie => Page.FrameLocator("iframe[name=\"rwExternalWire\"]").GetByRole(AriaRole.Cell, new() { Name = "-DOLP733PROPERTIE" });
        public ILocator CmgTab1DetailTabPageWfwcInternalWireDetail2TxtAccountCity => Page.FrameLocator("iframe[name=\"rwExternalWire\"]").Locator("#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountCity");
        public ILocator CmgTab1DetailTabPageWfwcInternalWireDetail2CmbToAccountStateArrow => Page.FrameLocator("iframe[name=\"rwExternalWire\"]").Locator("#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbToAccountState_Arrow");
        public ILocator Ar => Page.FrameLocator("iframe[name=\"rwExternalWire\"]").Locator("#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbToAccountState_DropDown").GetByText("AR");
        public ILocator Save => Page.FrameLocator("iframe[name=\"rwExternalWire\"]").GetByRole(AriaRole.Link, new() { Name = "Save" });
        public ILocator TransactionID5972746Has => Page.FrameLocator("iframe[name=\"rwExternalWire\"]").GetByText("Transaction ID 5972746 has");
        public ILocator SubmitNew => Page.FrameLocator("iframe[name=\"rwExternalWire\"]").GetByRole(AriaRole.Link, new() { Name = "Submit & New" });
        public ILocator TableATextClose => Page.Locator("//table//a[text()='Close']");
        public ILocator InputIDWfcContentContainerControl1RgExternalWireQueueRadComboBox1WfItemIDInput => Page.Locator("//input[@id='ctl00_ContentPlaceHolder1_WFC_ContentContainerControl1_ctl00_rgExternalWireQueue_ctl00_ctl02_ctl02_RadComboBox1WFItemID_Input']");
        public ILocator WfcContentContainerControl1RgExternalWireQueueRadComboBox1WfItemIDInput => Page.Locator("#ctl00_ContentPlaceHolder1_WFC_ContentContainerControl1_ctl00_rgExternalWireQueue_ctl00_ctl02_ctl02_RadComboBox1WFItemID_Input");

        public async Task ReplayAsync()
        {
            await NavigateToApplicationAsync();
            await OpenTargetModuleAsync();
            await ApplySearchCriteriaAsync();
        }

        public async Task NavigateToApplicationAsync()
        {
            // Review: URL at source line uses literal value because no matching appsettings Urls entry was found: https://cashadministration-mb-sit.trimont.com/WebForms/DashBoard.aspx
            await _commonActions.NavigateToURLAsync("https://cashadministration-mb-sit.trimont.com/WebForms/DashBoard.aspx");
            await Page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
        }

        public async Task OpenTargetModuleAsync()
        {
            await Assertions.Expect(ExternalWires).ToBeVisibleAsync();
            await ExternalWires.ClickAsync();
            await Assertions.Expect(CreateExternalWire).ToBeVisibleAsync();
            await CreateExternalWire.ClickAsync();
            await Assertions.Expect(CmgTab1DetailTabPageWfwcInternalWireDetailTxtAmount).ToBeVisibleAsync();
            await CmgTab1DetailTabPageWfwcInternalWireDetailTxtAmount.ClickAsync();
        }

        public async Task ApplySearchCriteriaAsync()
        {
            await Assertions.Expect(CmgTab1DetailTabPageWfwcInternalWireDetailTxtAmount).ToBeVisibleAsync();
            // Review: Literal input value preserved from recording. Consider replacing with framework data binding.
            await CmgTab1DetailTabPageWfwcInternalWireDetailTxtAmount.FillAsync("12");
            await Assertions.Expect(CmgTab1DetailTabPageWfwcInternalWireDetail2CmbRepetitiveCodeInput).ToBeVisibleAsync();
            await CmgTab1DetailTabPageWfwcInternalWireDetail2CmbRepetitiveCodeInput.ClickAsync();
            await Assertions.Expect(CmgTab1DetailTabPageWfwcInternalWireDetail2CmbRepetitiveCodeInput).ToBeVisibleAsync();
            // Review: Literal input value preserved from recording. Consider replacing with framework data binding.
            await CmgTab1DetailTabPageWfwcInternalWireDetail2CmbRepetitiveCodeInput.FillAsync("13");
            await Assertions.Expect(Dolp733Propertie).ToBeVisibleAsync();
            await Dolp733Propertie.ClickAsync();
            await Assertions.Expect(CmgTab1DetailTabPageWfwcInternalWireDetail2TxtAccountCity).ToBeVisibleAsync();
            await CmgTab1DetailTabPageWfwcInternalWireDetail2TxtAccountCity.ClickAsync();
            await Assertions.Expect(CmgTab1DetailTabPageWfwcInternalWireDetail2TxtAccountCity).ToBeVisibleAsync();
            // Review: Literal input value preserved from recording. Consider replacing with framework data binding.
            await CmgTab1DetailTabPageWfwcInternalWireDetail2TxtAccountCity.FillAsync("USA");
            await Assertions.Expect(CmgTab1DetailTabPageWfwcInternalWireDetail2CmbToAccountStateArrow).ToBeVisibleAsync();
            await CmgTab1DetailTabPageWfwcInternalWireDetail2CmbToAccountStateArrow.ClickAsync();
            await Assertions.Expect(Ar).ToBeVisibleAsync();
            await Ar.ClickAsync();
            await Assertions.Expect(Save).ToBeVisibleAsync();
            await Save.ClickAsync();
            await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await Assertions.Expect(TransactionID5972746Has).ToBeVisibleAsync();
            await TransactionID5972746Has.ClickAsync();
            await Assertions.Expect(SubmitNew).ToBeVisibleAsync();
            await SubmitNew.ClickAsync();
            await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await Assertions.Expect(TableATextClose).ToBeVisibleAsync();
            await TableATextClose.ClickAsync();
            await Assertions.Expect(InputIDWfcContentContainerControl1RgExternalWireQueueRadComboBox1WfItemIDInput).ToBeVisibleAsync();
            await InputIDWfcContentContainerControl1RgExternalWireQueueRadComboBox1WfItemIDInput.ClickAsync();
            await Assertions.Expect(WfcContentContainerControl1RgExternalWireQueueRadComboBox1WfItemIDInput).ToBeVisibleAsync();
            // Review: Literal input value preserved from recording. Consider replacing with framework data binding.
            await WfcContentContainerControl1RgExternalWireQueueRadComboBox1WfItemIDInput.FillAsync("5972746");
            await Assertions.Expect(WfcContentContainerControl1RgExternalWireQueueRadComboBox1WfItemIDInput).ToBeVisibleAsync();
            // Review: Literal input value preserved from recording. Consider replacing with framework data binding.
            await WfcContentContainerControl1RgExternalWireQueueRadComboBox1WfItemIDInput.PressAsync("Enter");
        }
    }
}
using Microsoft.Playwright;

namespace AutomationFrameWork.PageElements;

public class ViewLoanReconciliationObjects
{
    public const string EmployeeDropdownSelector = "#ctl00_WFC_ContentContainerCtrl_Main_ctl06_ContentPlaceHolder1_cboEmployee";

    public ILocator RunAsUserButton(IPage page) => page.GetByRole(AriaRole.Button, new() { Name = "Run As User" });
    public ILocator LoanMgmtLink(IPage page) => page.GetByRole(AriaRole.Link, new() { Name = "Loan Mgmt." });
    public ILocator CashMgmtAccountTextbox(IPage page) => page.GetByRole(AriaRole.Textbox, new() { Name = "Cash Mgmt. Acct.:" });
    public ILocator SearchButton(IPage page) => page.GetByRole(AriaRole.Button, new() { Name = "Search [Alt-S]" });
    public ILocator ViewReconLink(IPage page) => page.GetByRole(AriaRole.Link, new() { Name = "View Recon" });
    public ILocator GetReconButton(IPage page) => page.GetByRole(AriaRole.Button, new() { Name = "Get Recon" });
}

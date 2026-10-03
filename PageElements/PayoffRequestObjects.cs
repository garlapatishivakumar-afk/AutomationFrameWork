using Microsoft.Playwright;

namespace AutomationFrameWork.PageElements;

public class PayoffRequestObjects
{
    private readonly IPage _page;

    public PayoffRequestObjects(IPage page)
    {
        _page = page;
    }

    public ILocator CreatePayoffRequestLink =>
        _page.GetByRole(AriaRole.Link, new() { Name = "Create Payoff Request" });

    public ILocator SourceSystemDropdown =>
        _page.Locator("#ContentPlaceHolder1_pnlPayoffRequest_ctl00_cboSourceSystem");

    public ILocator LoanNumberInput =>
        _page.Locator("#ContentPlaceHolder1_pnlPayoffRequest_ctl00_txtLoanNumber");

    public ILocator PartialPaymentAmountInput =>
        _page.Locator("#ContentPlaceHolder1_pnlPayoffRequest_ctl00_txtPartialPaymentAmount");

    public ILocator RequesterNameInput =>
        _page.Locator("#ContentPlaceHolder1_pnlPayoffRequest_ctl00_txtRequesterName");

    public ILocator RequestTypeDropdown =>
        _page.GetByLabel("Request Type:");

    public ILocator FileListContainer =>
        _page.Locator("#ctl00_ContentPlaceHolder1_pnlPayoffRequest_ctl00_file1ListContainer");

    public ILocator UploadFileInput =>
        _page.Locator("input[type='file']").First;

    public ILocator UploadRequestButton =>
        _page.GetByRole(AriaRole.Button, new() { Name = "Upload Request" });

    public ILocator RequestSourceRequiredMessage =>
        _page.GetByText("Request Source is Required.");

    public ILocator PayoffRequestDocumentRequiredMessage =>
        _page.GetByText("Payoff Request Document is", new() { Exact = false });

    public ILocator InlineValidationErrors =>
        _page.Locator(".validation-summary-errors, .field-validation-error");
}
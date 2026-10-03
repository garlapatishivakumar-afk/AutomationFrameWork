using Microsoft.Playwright;

namespace AutomationFrameWork.PageElements;

public class DocumentManagementAdministrationObjects
{
    private readonly IPage _page;

    public DocumentManagementAdministrationObjects(IPage page)
    {
        _page = page;
    }

    public ILocator AdministrationLink =>
        _page.GetByRole(AriaRole.Link, new() { Name = "Administration" });

    public ILocator DocumentDownloadQueueLink =>
        _page.GetByRole(AriaRole.Link, new() { Name = "Document Download Queue" });

    public ILocator TransientErrorMessage =>
        _page.GetByText("An error has occurred");

    public ILocator DocGroupInput =>
        _page.Locator("#acbDocGroup_Input");

    public ILocator DocGroupLoanOption =>
        _page.GetByText("Loan", new() { Exact = true });

    public ILocator DocCategoryInput =>
        _page.Locator("#acbDocCategory_Input");

    public ILocator DocTypeInput =>
        _page.Locator("#acbDocType_Input");

    public ILocator DocSubTypeInput =>
        _page.Locator("#acbDocSubType_Input");

    public ILocator FormTypeInput =>
        _page.Locator("#acbFormType_Input");

    public ILocator AddFivePartKeyButton =>
        _page.GetByRole(AriaRole.Button, new() { Name = "Add Five-Part Key" });

    public ILocator AddSuccessMessage =>
        _page.GetByText("Document Five Part Key Added");

    public ILocator AddOrEditSuccessMessage =>
        _page.GetByText("Document Five Part Key", new() { Exact = false });

    public ILocator UpdateDocumentClassificationLink =>
        _page.GetByRole(AriaRole.Link, new() { Name = "Update Document Classification" });

    public ILocator FilterDocCategoryInput =>
        _page.GetByAltText("Filter DOC_CATEGORY_NAME");

    public ILocator ContainsFilterLink =>
        _page.GetByRole(AriaRole.Link, new() { Name = "Contains" });

    public ILocator LoanCell =>
        _page.GetByRole(AriaRole.Cell, new() { Name = "Loan", Exact = true });

    public ILocator EditButton =>
        _page.Locator("input.formButton[value='Edit']").First;

    public IFrameLocator EditDialogFrame =>
        _page.FrameLocator("iframe[name='rwEdit']");

    public ILocator CloseEditDialogLink =>
        _page.GetByRole(AriaRole.Link, new() { Name = "Close" });

    public ILocator UploadFileInput =>
        _page.Locator("input[type='file']").First;

    public ILocator NotesInput =>
        _page.Locator("#ctl00_ContentPlaceHolder1_txtNotes");

    public ILocator UploadButton =>
        _page.GetByRole(AriaRole.Button, new() { Name = "Upload" });

    public ILocator UploadSuccessMessage =>
        _page.GetByText("Upload successful. Queue ID:", new() { Exact = false });

    public ILocator NotesFilterInput =>
        _page.GetByAltText("Filter NOTES column");

    public ILocator DeleteQueueLink =>
        _page.GetByRole(AriaRole.Link, new() { Name = "🗑" }).First;

    public ILocator DeleteSuccessMessage =>
        _page.GetByText("Deleted Queue ID:", new() { Exact = false });
}

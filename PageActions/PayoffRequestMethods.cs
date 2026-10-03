using AutomationFrameWork.PageElements;
using AutomationFrameWork.Pages;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;

namespace AutomationFrameWork.PageActions;

public class PayoffRequestMethods
{
    private readonly IPage _page;
    private readonly ConfigReader _configReader;
    private readonly PayoffRequestObjects _objects;
    private readonly CommonActionsPage _commonActionsPage;

    public PayoffRequestMethods(IPage page, ConfigReader configReader)
    {
        _page = page ?? throw new ArgumentNullException(nameof(page));
        _configReader = configReader ?? throw new ArgumentNullException(nameof(configReader));
        _objects = new PayoffRequestObjects(page);
        _commonActionsPage = new CommonActionsPage(page);
    }

    public async Task OpenPayoffWorkQueueAsync()
    {
        var workQueueUrl = _configReader.Urls?.TryGetApplication("PayoffWorkQueueSearch");
        if (string.IsNullOrWhiteSpace(workQueueUrl))
        {
            throw new InvalidOperationException("PayoffWorkQueueSearch URL is missing from appsettings.json.");
        }

        await _commonActionsPage.NavigateToURLAsync(workQueueUrl);
        await _objects.CreatePayoffRequestLink.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 20000
        });
    }

    public async Task OpenCreatePayoffRequestAsync()
    {
        await _objects.CreatePayoffRequestLink.ClickAsync();
        await _objects.SourceSystemDropdown.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 20000
        });
    }

    public async Task FillPayoffRequestDetailsAsync(
        string sourceSystem,
        string loanNumber,
        string partialPaymentAmount,
        string requesterName,
        string requestType)
    {
        await _objects.SourceSystemDropdown.SelectOptionAsync(sourceSystem);

        await _objects.LoanNumberInput.ClickAsync();
        await _objects.LoanNumberInput.FillAsync(loanNumber);
        await _objects.LoanNumberInput.PressAsync("Enter");

        await _objects.PartialPaymentAmountInput.ClickAsync();
        await _objects.PartialPaymentAmountInput.FillAsync(partialPaymentAmount);

        await _objects.RequesterNameInput.ClickAsync();
        await _objects.RequesterNameInput.FillAsync(requesterName);

        await _objects.RequestTypeDropdown.SelectOptionAsync(requestType);

        if (!string.Equals(await _objects.LoanNumberInput.InputValueAsync(), loanNumber, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Loan number input value did not match the expected value.");
        }
    }

    public async Task UploadPayoffRequestDocumentAsync(string documentPath)
    {
        if (string.IsNullOrWhiteSpace(documentPath))
        {
            throw new ArgumentException("Document path cannot be empty.", nameof(documentPath));
        }

        var resolvedPath = documentPath;
        if (!Path.IsPathRooted(resolvedPath))
        {
            resolvedPath = Path.Combine(CommonActionsPage.GetProjectRoot(), resolvedPath.Replace('/', Path.DirectorySeparatorChar));
        }

        if (!File.Exists(resolvedPath))
        {
            throw new FileNotFoundException($"Upload file was not found at path: {resolvedPath}", resolvedPath);
        }

        await _objects.FileListContainer.ClickAsync();
        await _objects.UploadFileInput.SetInputFilesAsync(resolvedPath);
        await ClickUploadRequestAsync();
    }

    public async Task ClickUploadRequestAsync()
    {
        await _objects.UploadRequestButton.ClickAsync();
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task VerifyRequestSourceRequiredMessageAsync()
    {
        await _objects.RequestSourceRequiredMessage.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 20000
        });
        await _commonActionsPage.WaitAsync(3);
    }

    public async Task VerifyPayoffRequestDocumentRequiredMessageAsync()
    {
        await _objects.PayoffRequestDocumentRequiredMessage.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 20000
        });
        await _commonActionsPage.WaitAsync(3);
    }

    public async Task VerifySubmissionCompletedWithoutValidationErrorsAsync()
    {
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
        var errorCount = await _objects.InlineValidationErrors.CountAsync();
        if (errorCount > 0)
        {
            var firstError = await _objects.InlineValidationErrors.First.InnerTextAsync();
            throw new InvalidOperationException($"Payoff request submission showed validation errors: {firstError}");
        }
    }
}
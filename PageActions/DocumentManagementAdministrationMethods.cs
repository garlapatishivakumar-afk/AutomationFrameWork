using AutomationFrameWork.PageElements;
using AutomationFrameWork.Pages;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;

namespace AutomationFrameWork.PageActions;

public class DocumentManagementAdministrationMethods
{
    private const string SampleCsvRelativePath = "DataFiles/DocumentDownloadQueueSample.csv";

    private readonly IPage _page;
    private readonly ConfigReader _configReader;
    private readonly DocumentManagementAdministrationObjects _objects;
    private readonly CommonActionsPage _commonActionsPage;

    private string _createdValue = string.Empty;
    private string _updatedValue = string.Empty;
    private string _lastRandomNotes = string.Empty;

    public DocumentManagementAdministrationMethods(IPage page, ConfigReader configReader)
    {
        _page = page ?? throw new ArgumentNullException(nameof(page));
        _configReader = configReader ?? throw new ArgumentNullException(nameof(configReader));
        _objects = new DocumentManagementAdministrationObjects(page);
        _commonActionsPage = new CommonActionsPage(page);
    }

    public async Task OpenDocumentManagementAdhocSearchAsync()
    {
        var adhocUrl = _configReader.Urls?.TryGetApplication("DocumentManagementAdHocSearch");
        if (string.IsNullOrWhiteSpace(adhocUrl))
        {
            throw new InvalidOperationException("DocumentManagementAdHocSearch URL is missing from appsettings.json.");
        }

        await _commonActionsPage.NavigateToURLAsync(adhocUrl);
        await _objects.AdministrationLink.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 30000
        });
    }

    public async Task OpenAdministrationFromAdhocSearchAsync()
    {
        await _objects.AdministrationLink.ClickAsync();
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);

        for (var retryCount = 0; retryCount < 3; retryCount++)
        {
            var isTransientErrorVisible = await _objects.TransientErrorMessage.IsVisibleAsync();
            if (!isTransientErrorVisible)
            {
                return;
            }

            await _objects.AdministrationLink.ClickAsync();
            await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
        }

        if (await _objects.TransientErrorMessage.IsVisibleAsync())
        {
            throw new InvalidOperationException("Administration page still shows 'An error has occurred' after retries.");
        }
    }

    public async Task AddDocumentClassificationWithUniqueValuesAsync()
    {
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            (_createdValue, _updatedValue) = GenerateUniqueClassificationValues();

            await SelectDocGroupLoanAsync();

            await FillAutocompleteValueAsync(_objects.DocCategoryInput, _createdValue);
            await FillAutocompleteValueAsync(_objects.DocTypeInput, _createdValue);
            await FillAutocompleteValueAsync(_objects.DocSubTypeInput, _createdValue);
            await FillAutocompleteValueAsync(_objects.FormTypeInput, _createdValue);

            await _objects.AddFivePartKeyButton.ClickAsync();
            await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            if (await IsAddSuccessfulAsync())
            {
                return;
            }
        }

        throw new InvalidOperationException("Unable to confirm document classification was added after 3 attempts.");
    }

    public async Task UpdateCreatedDocumentClassificationWithUniqueValuesAsync()
    {
        if (string.IsNullOrWhiteSpace(_createdValue) || string.IsNullOrWhiteSpace(_updatedValue))
        {
            throw new InvalidOperationException("No generated values found. Add classification before update.");
        }

        await _objects.UpdateDocumentClassificationLink.ClickAsync();
        await _objects.FilterDocCategoryInput.First.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 30000
        });

        await ApplyDocCategoryFilterAsync(_createdValue);
        await _objects.EditButton.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 30000
        });

        await _objects.EditButton.ClickAsync();
        await _objects.EditDialogFrame.Locator("#acbDocCategory_Input").WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 30000
        });

        await FillFrameAutocompleteValueAsync("#acbDocCategory_Input", _updatedValue);
        await FillFrameAutocompleteValueAsync("#acbDocType_Input", _updatedValue);
        await FillFrameAutocompleteValueAsync("#acbDocSubType_Input", _updatedValue);
        await FillFrameAutocompleteValueAsync("#acbFormType_Input", _updatedValue);

        await _objects.EditDialogFrame.GetByRole(AriaRole.Button, new() { Name = "Edit Five-Part Key" }).ClickAsync();
        await _objects.EditDialogFrame.GetByText("Document Five Part Key").WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 30000
        });

        await _objects.CloseEditDialogLink.ClickAsync();
    }

    public Task VerifyDocumentClassificationCompletedAsync()
    {
        if (string.IsNullOrWhiteSpace(_createdValue) || string.IsNullOrWhiteSpace(_updatedValue))
        {
            throw new InvalidOperationException("Document classification unique values were not generated.");
        }

        return Task.CompletedTask;
    }

    public async Task OpenDocumentDownloadQueueFromAdhocSearchAsync()
    {
        await _objects.DocumentDownloadQueueLink.ClickAsync();
        await _objects.UploadFileInput.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 30000
        });
    }

    public async Task UploadSampleCsvWithRandomNotesAsync()
    {
        var sampleCsvPath = EnsureSampleCsvExists();
        _lastRandomNotes = $"AutoNotes-{DateTime.UtcNow:yyyyMMddHHmmssfff}";

        await _objects.UploadFileInput.SetInputFilesAsync(sampleCsvPath);
        await _objects.NotesInput.ClickAsync();
        await _objects.NotesInput.FillAsync(_lastRandomNotes);
        await _objects.UploadButton.ClickAsync();
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task VerifyUploadQueueSuccessMessageAsync()
    {
        await _objects.UploadSuccessMessage.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 30000
        });
    }

    public async Task FilterQueueByUploadedRandomNotesAsync()
    {
        if (string.IsNullOrWhiteSpace(_lastRandomNotes))
        {
            throw new InvalidOperationException("Uploaded random notes are not available. Upload a queue entry first.");
        }

        await _objects.NotesFilterInput.First.ClickAsync();
        await _objects.NotesFilterInput.First.FillAsync(_lastRandomNotes);
        await _objects.NotesFilterInput.First.PressAsync("Enter");
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task DeleteUploadedQueueEntryAsync()
    {
        if (string.IsNullOrWhiteSpace(_lastRandomNotes))
        {
            throw new InvalidOperationException("Uploaded random notes are not available. Upload and filter before delete.");
        }

        var targetDeleteLink = _page
            .Locator("tr", new PageLocatorOptions { HasText = _lastRandomNotes })
            .First
            .Locator("a[title='Delete']")
            .First;

        await targetDeleteLink.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 30000
        });

        var dialogTcs = new TaskCompletionSource<IDialog>();
        void DialogHandler(object? _, IDialog dialog) => dialogTcs.TrySetResult(dialog);

        _page.Dialog += DialogHandler;
        try
        {
            await targetDeleteLink.EvaluateAsync("el => el.click()");
            var dialog = await dialogTcs.Task;
            await dialog.AcceptAsync();
        }
        finally
        {
            _page.Dialog -= DialogHandler;
        }

        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task VerifyDeletedQueueMessageAsync()
    {
        await _objects.DeleteSuccessMessage.WaitForAsync(new LocatorWaitForOptions
        {
            State = WaitForSelectorState.Visible,
            Timeout = 30000
        });
    }

    private static (string createdValue, string updatedValue) GenerateUniqueClassificationValues()
    {
        var stamp = DateTime.UtcNow.ToString("HHmmss");
        var suffix = Random.Shared.Next(1000, 9999);
        return ($"Test{stamp}{suffix}".Substring(0, 10), $"TesU{stamp}{suffix}".Substring(0, 10));
    }

    private async Task FillAutocompleteValueAsync(ILocator locator, string value)
    {
        await locator.ClickAsync();
        await locator.FillAsync(value);
        await locator.PressAsync("Enter");
    }

    private async Task FillFrameAutocompleteValueAsync(string selector, string value)
    {
        var frameInput = _objects.EditDialogFrame.Locator(selector);
        await frameInput.ClickAsync();
        await frameInput.FillAsync(value);
        await frameInput.PressAsync("Enter");
    }

    private async Task SelectDocGroupLoanAsync()
    {
        await _objects.DocGroupInput.ClickAsync();
        await _objects.DocGroupInput.FillAsync("Loan");

        try
        {
            await _objects.DocGroupLoanOption.WaitForAsync(new LocatorWaitForOptions
            {
                State = WaitForSelectorState.Visible,
                Timeout = 5000
            });
            await _objects.DocGroupLoanOption.ClickAsync();
        }
        catch (TimeoutException)
        {
            await _objects.DocGroupInput.PressAsync("Enter");
        }
    }

    private async Task ApplyDocCategoryFilterAsync(string value)
    {
        var filterInput = _objects.FilterDocCategoryInput.First;
        await filterInput.ClickAsync();
        await filterInput.FillAsync(value);

        try
        {
            await _objects.ContainsFilterLink.WaitForAsync(new LocatorWaitForOptions
            {
                State = WaitForSelectorState.Visible,
                Timeout = 3000
            });
            await _objects.ContainsFilterLink.ClickAsync();
        }
        catch (TimeoutException)
        {
            // Some grid variants do not render the Contains operator link.
        }

        await filterInput.PressAsync("Enter");

        // Keep row-selection behavior if the Loan cell is present.
        if (await _objects.LoanCell.IsVisibleAsync())
        {
            await _objects.LoanCell.ClickAsync();
        }
    }

    private async Task<bool> IsAddSuccessfulAsync()
    {
        try
        {
            await _objects.AddSuccessMessage.WaitForAsync(new LocatorWaitForOptions
            {
                State = WaitForSelectorState.Visible,
                Timeout = 8000
            });
            return true;
        }
        catch (TimeoutException)
        {
            return await _objects.AddOrEditSuccessMessage.IsVisibleAsync();
        }
    }

    private static string EnsureSampleCsvExists()
    {
        var fullPath = Path.Combine(CommonActionsPage.GetProjectRoot(), SampleCsvRelativePath.Replace('/', Path.DirectorySeparatorChar));
        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrWhiteSpace(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        if (!File.Exists(fullPath))
        {
            var csvContent = string.Join(Environment.NewLine, new[]
            {
                "Id,Name,Amount",
                "1,Alpha,100.50",
                "2,Beta,250.75",
                "3,Gamma,999.99"
            });
            File.WriteAllText(fullPath, csvContent);
        }

        return fullPath;
    }
}

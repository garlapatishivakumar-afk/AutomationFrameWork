using AutomationFrameWork.Drivers;
using AutomationFrameWork.Helpers;
using AutomationFrameWork.PageActions;
using AutomationFrameWork.Pages;
using AutomationFrameWork.Utilities;
using Reqnroll;

namespace AutomationFrameWork.StepDefinitions;

[Binding]
public class PayoffRequestSteps : BaseSteps
{
    private const string PayoffRequestExcelFilePath = "DataFiles/RequestUnsecureTaxBillData.xlsx";
    private const string PayoffRequestExcelSheetName = "PayoffRequest";
    private const int PayoffRequestExcelDefaultRowNumber = 1;

    private readonly PayoffRequestMethods _methods;
    private PayoffRequestExcelRow? _currentExcelRow;

    public PayoffRequestSteps(PlaywrightDriver playwrightDriver, ScenarioContext scenarioContext)
        : base(playwrightDriver, scenarioContext)
    {
        var configReader = scenarioContext.Get<ConfigReader>("ConfigReader");
        _methods = new PayoffRequestMethods(playwrightDriver.Page, configReader);
    }

    [Given("the user is on the payoff work queue page")]
    public async Task GivenTheUserIsOnThePayoffWorkQueuePage()
    {
        await _methods.OpenPayoffWorkQueueAsync();
    }

    [When("the user opens create payoff request")]
    public async Task WhenTheUserOpensCreatePayoffRequest()
    {
        await _methods.OpenCreatePayoffRequestAsync();
    }

    [When("the user enters payoff request details with source system {string}, loan number {string}, partial payment amount {string}, requester name {string}, and request type {string}")]
    public async Task WhenTheUserEntersPayoffRequestDetails(
        string sourceSystem,
        string loanNumber,
        string partialPaymentAmount,
        string requesterName,
        string requestType)
    {
        await _methods.FillPayoffRequestDetailsAsync(
            sourceSystem,
            loanNumber,
            partialPaymentAmount,
            requesterName,
            requestType);
    }

    [When("the user uploads payoff request document {string}")]
    public async Task WhenTheUserUploadsPayoffRequestDocument(string documentPath)
    {
        await _methods.UploadPayoffRequestDocumentAsync(documentPath);
    }

    [When("the user clicks upload request")]
    public async Task WhenTheUserClicksUploadRequest()
    {
        await _methods.ClickUploadRequestAsync();
    }

    [Then("the user should see request source required message")]
    public async Task ThenTheUserShouldSeeRequestSourceRequiredMessage()
    {
        await _methods.VerifyRequestSourceRequiredMessageAsync();
    }

    [Then("the user should see payoff request document required message")]
    public async Task ThenTheUserShouldSeePayoffRequestDocumentRequiredMessage()
    {
        await _methods.VerifyPayoffRequestDocumentRequiredMessageAsync();
    }

    [Then("the payoff request submission should complete without validation errors")]
    public async Task ThenThePayoffRequestSubmissionShouldCompleteWithoutValidationErrors()
    {
        await _methods.VerifySubmissionCompletedWithoutValidationErrorsAsync();
    }

    [When("the user enters payoff request details from excel")]
    public async Task WhenTheUserEntersPayoffRequestDetailsFromExcel()
    {
        _currentExcelRow = LoadPayoffRequestExcelRow(PayoffRequestExcelDefaultRowNumber);
        await _methods.FillPayoffRequestDetailsAsync(
            _currentExcelRow.SourceSystem,
            _currentExcelRow.LoanNumber,
            _currentExcelRow.PartialPaymentAmount,
            _currentExcelRow.RequesterName,
            _currentExcelRow.RequestType);
    }

    [When("the user uploads payoff request document from excel")]
    public async Task WhenTheUserUploadsPayoffRequestDocumentFromExcel()
    {
        _currentExcelRow ??= LoadPayoffRequestExcelRow(PayoffRequestExcelDefaultRowNumber);
        await _methods.UploadPayoffRequestDocumentAsync(_currentExcelRow.DocumentPath);
    }

    [When("the user validates required messages and fills payoff request from excel")]
    public async Task WhenTheUserValidatesRequiredMessagesAndFillsPayoffRequestFromExcel()
    {
        var row = LoadPayoffRequestExcelRow(PayoffRequestExcelDefaultRowNumber);

        await _methods.ClickUploadRequestAsync();
        await _methods.VerifyRequestSourceRequiredMessageAsync();

        await _methods.FillPayoffRequestDetailsAsync(
            row.SourceSystem,
            row.LoanNumber,
            row.PartialPaymentAmount,
            row.RequesterName,
            row.RequestType);

        await _methods.ClickUploadRequestAsync();
        await _methods.VerifyPayoffRequestDocumentRequiredMessageAsync();
        await _methods.UploadPayoffRequestDocumentAsync(row.DocumentPath);
    }

    private static PayoffRequestExcelRow LoadPayoffRequestExcelRow(int rowNumber)
    {
        if (rowNumber < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(rowNumber), "Row number must be 1 or greater.");
        }

        var resolvedPath = ResolveProjectRelativePath(PayoffRequestExcelFilePath);
        var excelUtility = new ExcelUtility(resolvedPath);
        var rows = excelUtility.ReadAsList<PayoffRequestExcelRow>(PayoffRequestExcelSheetName);

        if (rows.Count < rowNumber)
        {
            throw new InvalidOperationException(
                $"Requested row {rowNumber} was not found in sheet '{PayoffRequestExcelSheetName}' for file '{resolvedPath}'. Available rows: {rows.Count}.");
        }

        var row = rows[rowNumber - 1];
        ValidateRequiredExcelFields(row, resolvedPath, rowNumber);
        return row;
    }

    private static string ResolveProjectRelativePath(string path)
    {
        if (Path.IsPathRooted(path))
        {
            return path;
        }

        return Path.Combine(CommonActionsPage.GetProjectRoot(), path.Replace('/', Path.DirectorySeparatorChar));
    }

    private static void ValidateRequiredExcelFields(PayoffRequestExcelRow row, string filePath, int rowNumber)
    {
        if (string.IsNullOrWhiteSpace(row.SourceSystem) ||
            string.IsNullOrWhiteSpace(row.LoanNumber) ||
            string.IsNullOrWhiteSpace(row.PartialPaymentAmount) ||
            string.IsNullOrWhiteSpace(row.RequesterName) ||
            string.IsNullOrWhiteSpace(row.RequestType) ||
            string.IsNullOrWhiteSpace(row.DocumentPath))
        {
            throw new InvalidOperationException(
                $"One or more required columns are empty at row {rowNumber} in sheet '{PayoffRequestExcelSheetName}' of file '{filePath}'. Required columns: SourceSystem, LoanNumber, PartialPaymentAmount, RequesterName, RequestType, DocumentPath.");
        }
    }

    private class PayoffRequestExcelRow
    {
        public string SourceSystem { get; set; } = string.Empty;
        public string LoanNumber { get; set; } = string.Empty;
        public string PartialPaymentAmount { get; set; } = string.Empty;
        public string RequesterName { get; set; } = string.Empty;
        public string RequestType { get; set; } = string.Empty;
        public string DocumentPath { get; set; } = string.Empty;
    }
}
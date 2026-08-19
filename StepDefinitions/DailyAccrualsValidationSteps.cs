using AutomationFrameWork.Helpers;
using AutomationFrameWork.Models;
using AutomationFrameWork.Pages;
using Reqnroll;
using System.Text;

namespace AutomationFrameWork.StepDefinitions;

[Binding]
public class DailyAccrualsValidationSteps
{
    private readonly ScenarioContext _scenarioContext;
    private readonly DailyAccrualsFileReader _fileReader;
    private readonly AccrualsCalculationEngine _engine;

    private LoanMetadata? _metadata;
    private List<SourceTransaction>? _sourceTransactions;
    private List<AccrualRecord>? _idealRecords;
    private List<AccrualValidationResult>? _validationResults;
    private string _sourceFileName = string.Empty;
    private string _idealFileName = string.Empty;

    public DailyAccrualsValidationSteps(ScenarioContext scenarioContext)
    {
        _scenarioContext = scenarioContext;
        _fileReader = new DailyAccrualsFileReader();
        _engine = new AccrualsCalculationEngine();
    }

    [Given("the source file {string} and ideal accruals file {string} are loaded")]
    public void GivenTheFilesAreLoaded(string sourceFileName, string idealFileName)
    {
        var projectRoot = CommonActionsPage.GetProjectRoot();

        _sourceFileName = sourceFileName;
        _idealFileName = idealFileName;

        var sourcePath = Path.Combine(projectRoot, "Data", "Source", sourceFileName);
        var idealPath = Path.Combine(projectRoot, "Data", "Validation", idealFileName);

        _metadata = _fileReader.ReadLoanMetadata(idealPath);
        _idealRecords = _fileReader.ReadIdealAccrualRecords(idealPath);
        _sourceTransactions = _fileReader.ReadSourceTransactions(sourcePath, _metadata.LoanNumber);

        Console.WriteLine($"Loan: {_metadata.LoanNumber}, Date Range: {_metadata.DateFrom:d} to {_metadata.DateTo:d}");
        Console.WriteLine($"Source transactions loaded: {_sourceTransactions.Count}");
        Console.WriteLine($"Ideal accrual records loaded: {_idealRecords.Count} (expected: {_metadata.TotalRecords})");
    }

    [When("the daily accruals are calculated from source transactions using business rules")]
    public void WhenDailyAccrualsAreCalculated()
    {
        _validationResults = _engine.Validate(_sourceTransactions!, _idealRecords!);

        var failCount = _validationResults.Count(r => !r.IsValid);
        Console.WriteLine($"Validation complete: {_validationResults.Count} rows checked, {failCount} failures.");
    }

    [Then("all principal balances should match the ideal file")]
    public void ThenAllPrincipalBalancesShouldMatch()
    {
        AssertNoMismatchesFor("PrincipalBalance (H)");
    }

    [Then("all daily accrual interest amounts should match the ideal file")]
    public void ThenAllDailyAccrualsShouldMatch()
    {
        AssertNoMismatchesFor("DailyAccrual (I)");
    }

    [Then("all accumulated interest values should match the ideal file")]
    public void ThenAllAccumulatedInterestShouldMatch()
    {
        AssertNoMismatchesFor("AccumulatedOnOriginal (J)");
    }

    [Then("all compound interest values should match the ideal file")]
    public void ThenAllCompoundInterestShouldMatch()
    {
        AssertNoMismatchesFor("CompoundedBasis (K)");
        AssertNoMismatchesFor("DailyAccrualOnCompound (L)");
        AssertNoMismatchesFor("AccumulatedOnCompounded (M)");
    }

    [Then("all total balances should match the ideal file")]
    public void ThenAllTotalBalancesShouldMatch()
    {
        AssertNoMismatchesFor("TotalBalance (N)");
    }

    [Then("all advance and repayment amounts should match the ideal file")]
    public void ThenAllAdvancesAndRepaymentsShouldMatch()
    {
        AssertNoMismatchesFor("Advances (O)");
        AssertNoMismatchesFor("TotalRepayments (P)");
        AssertNoMismatchesFor("PrincipalRepayment (Q)");
        AssertNoMismatchesFor("InterestOnOriginalRepayment (S)");
    }

    [Then("all overpayment balances should match the ideal file")]
    public void ThenAllOverpaymentBalancesShouldMatch()
    {
        AssertNoMismatchesFor("OverpaymentBalance (X)");
        AssertNoMismatchesFor("IOAOverpaymentBalance (Y)");
        AssertNoMismatchesFor("OverpaymentAllocation (Z)");
    }

    private void AssertNoMismatchesFor(string fieldName)
    {
        var failures = _validationResults!
            .Where(r => r.Mismatches.Any(m => m.StartsWith(fieldName)))
            .ToList();

        if (!failures.Any()) return;

        var sb = new StringBuilder();
        sb.AppendLine($"Validation failures for [{fieldName}] — {failures.Count} row(s) failed:");

        foreach (var failure in failures.Take(20))
        {
            var mismatch = failure.Mismatches.First(m => m.StartsWith(fieldName));
            sb.AppendLine($"  Date: {failure.AccrualDate:yyyy-MM-dd}, Type: {failure.AdvanceType} → {mismatch}");
        }

        if (failures.Count > 20)
            sb.AppendLine($"  ... and {failures.Count - 20} more.");

        throw new Exception(sb.ToString());
    }

    [AfterScenario]
    public void AfterScenario()
    {
        if (_validationResults == null) return;

        var projectRoot  = CommonActionsPage.GetProjectRoot();
        var outputFolder = Path.Combine(projectRoot, "Reports", "DailyAccruals");
        var idealPath    = Path.Combine(projectRoot, "Data", "Validation", _idealFileName);

        // 1. Word report
        var writer = new AccrualsWordReportWriter();
        var reportPath = writer.WriteReport(
            _validationResults,
            _sourceFileName,
            _idealFileName,
            outputFolder);
        Console.WriteLine($"Word report saved: {reportPath}");

        // 2. Annotate the ideal Excel file: highlight error cells red + add error sheet
        if (!string.IsNullOrEmpty(_idealFileName) && File.Exists(idealPath))
        {
            var annotator = new AccrualsExcelAnnotator();
            annotator.AnnotateAndWriteErrorSheet(idealPath, _validationResults);
            Console.WriteLine($"Excel annotated with errors: {idealPath}");
        }
    }
}

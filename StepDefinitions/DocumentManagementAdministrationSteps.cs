using AutomationFrameWork.Drivers;
using AutomationFrameWork.PageActions;
using AutomationFrameWork.Utilities;
using Reqnroll;

namespace AutomationFrameWork.StepDefinitions;

[Binding]
public class DocumentManagementAdministrationSteps : BaseSteps
{
    private readonly DocumentManagementAdministrationMethods _methods;

    public DocumentManagementAdministrationSteps(PlaywrightDriver playwrightDriver, ScenarioContext scenarioContext)
        : base(playwrightDriver, scenarioContext)
    {
        var configReader = scenarioContext.Get<ConfigReader>("ConfigReader");
        _methods = new DocumentManagementAdministrationMethods(playwrightDriver.Page, configReader);
    }

    [Given("the user is on the document management adhoc search page")]
    public async Task GivenTheUserIsOnTheDocumentManagementAdhocSearchPage()
    {
        await _methods.OpenDocumentManagementAdhocSearchAsync();
    }

    [When("the user opens administration from adhoc search")]
    public async Task WhenTheUserOpensAdministrationFromAdhocSearch()
    {
        await _methods.OpenAdministrationFromAdhocSearchAsync();
    }

    [When("the user adds a document classification with unique values")]
    public async Task WhenTheUserAddsADocumentClassificationWithUniqueValues()
    {
        await _methods.AddDocumentClassificationWithUniqueValuesAsync();
    }

    [When("the user updates the created document classification with unique values")]
    public async Task WhenTheUserUpdatesTheCreatedDocumentClassificationWithUniqueValues()
    {
        await _methods.UpdateCreatedDocumentClassificationWithUniqueValuesAsync();
    }

    [Then("the document classification add and update should complete successfully")]
    public async Task ThenTheDocumentClassificationAddAndUpdateShouldCompleteSuccessfully()
    {
        await _methods.VerifyDocumentClassificationCompletedAsync();
    }

    [When("the user opens document download queue from adhoc search")]
    public async Task WhenTheUserOpensDocumentDownloadQueueFromAdhocSearch()
    {
        await _methods.OpenDocumentDownloadQueueFromAdhocSearchAsync();
    }

    [When("the user uploads a sample csv with random notes")]
    public async Task WhenTheUserUploadsASampleCsvWithRandomNotes()
    {
        await _methods.UploadSampleCsvWithRandomNotesAsync();
    }

    [Then("upload successful queue id message should be displayed")]
    public async Task ThenUploadSuccessfulQueueIdMessageShouldBeDisplayed()
    {
        await _methods.VerifyUploadQueueSuccessMessageAsync();
    }

    [When("the user filters queue by uploaded random notes")]
    public async Task WhenTheUserFiltersQueueByUploadedRandomNotes()
    {
        await _methods.FilterQueueByUploadedRandomNotesAsync();
    }

    [When("the user deletes the uploaded queue entry")]
    public async Task WhenTheUserDeletesTheUploadedQueueEntry()
    {
        await _methods.DeleteUploadedQueueEntryAsync();
    }

    [Then("deleted queue id message should be displayed")]
    public async Task ThenDeletedQueueIdMessageShouldBeDisplayed()
    {
        await _methods.VerifyDeletedQueueMessageAsync();
    }
}

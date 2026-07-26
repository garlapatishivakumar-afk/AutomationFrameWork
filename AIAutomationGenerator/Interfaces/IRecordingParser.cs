using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IRecordingParser
{
    List<RecordingActionModel> Parse(string codeFile);
}
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Recording;

public class RecordingParser : IRecordingParser
{
    public List<RecordingActionModel> Parse(string codeFile)
    {
        List<RecordingActionModel> actions = new();
        int sequence = 1;
        foreach (string line in File.ReadLines(codeFile))
        {
            RecordingActionModel action = new();
            action.Sequence = sequence++;
            if (line.Contains(".ClickAsync("))
                action.ActionType = "Click";
            else if (line.Contains(".FillAsync("))
                action.ActionType = "Fill";
            else if (line.Contains(".CheckAsync("))
                action.ActionType = "Check";
            else if (line.Contains(".SelectOptionAsync("))
                action.ActionType = "Select";
            else if (line.Contains(".PressAsync("))
                action.ActionType = "Press";
            else
                continue;
                
            action.Target = line.Trim();
            action.RawCode = line;
            if (line.Contains("GetByRole"))
                action.LocatorType = "Role";
            else if (line.Contains("Locator("))
                action.LocatorType = "Css";
            else if (line.Contains("GetByText"))
                action.LocatorType = "Text";
            action.LocatorValue = line;
            if (action.ActionType == "Fill")
            {
                int start = line.IndexOf("FillAsync(");
                if (start >= 0)
                {
                    string value = line[(start + 10)..];
                    value = value.TrimEnd(')', ';');
                    action.InputValue = value;
                }
            }
                        actions.Add(action);
                    }
        return actions;
    }
}
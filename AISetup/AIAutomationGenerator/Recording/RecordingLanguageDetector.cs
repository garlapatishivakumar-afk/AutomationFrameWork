using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Recording;

public static class RecordingLanguageDetector
{
    public static RecordingLanguage Detect(IEnumerable<string> lines)
    {
        string content = string.Join(Environment.NewLine, lines);

        if (content.Contains(".ClickAsync(") ||
            content.Contains(".FillAsync(") ||
            content.Contains(".SelectOptionAsync("))
        {
            return RecordingLanguage.CSharp;
        }

        if (content.Contains(".click(") ||
            content.Contains(".fill(") ||
            content.Contains(".selectOption("))
        {
            return RecordingLanguage.TypeScript;
        }

        return RecordingLanguage.Unknown;
    }
}

using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using System.Text.RegularExpressions;

namespace AIAutomationGenerator.Recording;

public class RecordingParser : IRecordingParser
{
    public List<RecordingActionModel> Parse(string codeFile)
    {
        List<string> lines = File.ReadAllLines(codeFile).ToList();

        var popupPromiseByWindow = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var popupWindows = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var variables = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        List<RecordingActionModel> actions = new();
        foreach (string line in lines)
        {
            TrackVariables(line, variables);
            TrackPopupVariables(line, popupPromiseByWindow, popupWindows);

            string pageName = ExtractPageVariable(line);
            string popupWindow = ResolvePopupWindow(line, pageName, popupPromiseByWindow, popupWindows);

            string actionType = ResolveActionType(line);
            if (string.IsNullOrEmpty(actionType))
            {
                continue;
            }

            RecordingActionModel action = new();
            action.Sequence = actions.Count + 1;
            action.ActionType = actionType;
            action.RawCode = line;
            action.PageName = pageName;
            action.IsPopupAction = !string.IsNullOrWhiteSpace(popupWindow);
            action.WindowName = popupWindow;

            string rawInputValue = ExtractInputValue(line);
            action.InputValue = ResolveInputValue(rawInputValue, variables, out string variableName);
            action.VariableName = variableName;

            action.LocatorType = ResolveLocatorType(line);
            action.LocatorChain = ExtractLocatorChain(line);
            action.LocatorValue = ExtractLocatorValue(action.LocatorChain, action.LocatorType);
            action.LocatorExpression = ExtractLocatorExpression(action.LocatorChain);
            action.LocatorArgument = ExtractLocatorArgument(action.LocatorChain, action.LocatorExpression);
            action.FrameName = ExtractFrameName(action.LocatorChain);
            action.IsFrameAction = action.LocatorType == "Frame" || !string.IsNullOrWhiteSpace(action.FrameName);
            action.ContextType = action.IsFrameAction
                ? "Frame"
                : action.IsPopupAction
                    ? "Popup"
                    : "MainWindow";

            if (action.ActionType == "Navigate")
            {
                action.Target = action.InputValue;
                action.Url = action.InputValue;
            }
            else if (action.ActionType == "Assert")
            {
                action.Target = line.Trim();
                action.Assertion = line.Trim();
            }
            else
            {
                action.Target = line.Trim();
            }

            actions.Add(action);
        }

        return actions;
    }

    private static string ResolveActionType(string line)
    {
        if (IsAssert(line))
            return "Assert";
        if (IsUpload(line))
            return "Upload";
        if (IsDragDrop(line))
            return "DragDrop";
        if (IsKeyboard(line))
            return "Keyboard";
        if (IsMouse(line))
            return "Mouse";
        if (IsClick(line))
            return "Click";
        if (IsFill(line))
            return "Fill";
        if (IsSelect(line))
            return "Select";
        if (IsCheck(line))
            return "Check";
        if (IsPress(line))
            return "Press";
        if (IsNavigate(line))
            return "Navigate";
        if (IsPopup(line))
            return "Popup";
        if (IsWait(line))
            return "Wait";
        if (IsHover(line))
            return "Hover";
        if (IsDoubleClick(line))
            return "DoubleClick";

        return string.Empty;
    }

    private static bool IsAssert(string line)
    {
        return ContainsAnyIgnoreCase(
            line,
            "expect(",
            "Expect(",
            "toHaveText",
            "toContainText",
            "toBeVisible",
            "toBeHidden",
            "toHaveValue",
            "toHaveURL",
            "toHaveCount",
            "toHaveClass",
            "toBeChecked",
            "toBeDisabled",
            "toBeEnabled",
            "ToHaveText",
            "ToContainText",
            "ToBeVisible",
            "ToBeHidden",
            "ToHaveValue",
            "ToHaveURL",
            "ToHaveCount",
            "ToHaveClass",
            "ToBeChecked",
            "ToBeDisabled",
            "ToBeEnabled");
    }

    private static bool IsUpload(string line)
    {
        return line.Contains("setInputFiles(")
            || line.Contains("SetInputFilesAsync(");
    }

    private static bool IsDragDrop(string line)
    {
        return line.Contains(".dragTo(")
            || line.Contains(".DragToAsync(");
    }

    private static bool IsKeyboard(string line)
    {
        return line.Contains("keyboard.press(")
            || line.Contains("keyboard.type(")
            || line.Contains("keyboard.insertText(")
            || line.Contains("keyboard.down(")
            || line.Contains("keyboard.up(")
            || line.Contains("Keyboard.PressAsync(")
            || line.Contains("Keyboard.TypeAsync(")
            || line.Contains("Keyboard.InsertTextAsync(")
            || line.Contains("Keyboard.DownAsync(")
            || line.Contains("Keyboard.UpAsync(");
    }

    private static bool IsMouse(string line)
    {
        return line.Contains("mouse.move(")
            || line.Contains("mouse.click(")
            || line.Contains("mouse.wheel(")
            || line.Contains("mouse.down(")
            || line.Contains("mouse.up(")
            || line.Contains("Mouse.MoveAsync(")
            || line.Contains("Mouse.ClickAsync(")
            || line.Contains("Mouse.WheelAsync(")
            || line.Contains("Mouse.DownAsync(")
            || line.Contains("Mouse.UpAsync(");
    }

    private static bool IsClick(string line)
    {
        return line.Contains(".ClickAsync(")
            || line.Contains(".click(");
    }

    private static bool IsFill(string line)
    {
        return line.Contains(".FillAsync(")
            || line.Contains(".fill(");
    }

    private static bool IsSelect(string line)
    {
        return line.Contains(".SelectOptionAsync(")
            || line.Contains(".selectOption(");
    }

    private static bool IsCheck(string line)
    {
        return line.Contains(".CheckAsync(")
            || line.Contains(".check(");
    }

    private static bool IsPress(string line)
    {
        return line.Contains(".PressAsync(")
            || line.Contains(".press(");
    }

    private static bool IsNavigate(string line)
    {
        return line.Contains(".GotoAsync(")
            || line.Contains(".goto(");
    }

    private static bool IsPopup(string line)
    {
        return line.Contains("waitForEvent('popup'", StringComparison.Ordinal)
            || line.Contains("waitForEvent(\"popup\"", StringComparison.Ordinal)
            || line.Contains("waitForPopup(", StringComparison.Ordinal)
            || line.Contains("WaitForPopupAsync(", StringComparison.Ordinal)
            || line.Contains("RunAndWaitForPopupAsync(", StringComparison.Ordinal)
            || line.Contains(".WaitForPopupAsync(", StringComparison.Ordinal);
    }

    private static bool IsWait(string line)
    {
        return line.Contains("waitForLoadState(")
            || line.Contains("waitForTimeout(")
            || line.Contains("WaitForLoadStateAsync(")
            || line.Contains("WaitForTimeoutAsync(");
    }

    private static bool IsHover(string line)
    {
        return line.Contains(".hover(")
            || line.Contains(".HoverAsync(");
    }

    private static bool IsDoubleClick(string line)
    {
        return line.Contains(".dblclick(")
            || line.Contains(".DblClickAsync(");
    }

    private static string ResolveLocatorType(string line)
    {
        if (line.Contains("GetByRole") || line.Contains("getByRole"))
            return "Role";
        if (line.Contains("GetByLabel") || line.Contains("getByLabel"))
            return "Label";
        if (line.Contains("GetByText") || line.Contains("getByText"))
            return "Text";
        if (line.Contains("GetById") || line.Contains("getById") || Regex.IsMatch(line, "locator\\(\\s*['\"]#[^'\"]+['\"]\\)", RegexOptions.IgnoreCase))
            return "Id";
        if (line.Contains("GetByName") || line.Contains("getByName") || line.Contains("[name=", StringComparison.OrdinalIgnoreCase))
            return "Name";
        if (line.Contains("FrameLocator(") || line.Contains("frameLocator("))
            return "Frame";
        if (line.Contains("xpath=", StringComparison.OrdinalIgnoreCase) || line.Contains("By.XPath", StringComparison.Ordinal) || line.Contains(".xpath(", StringComparison.OrdinalIgnoreCase))
            return "XPath";
        if (line.Contains("Locator(") || line.Contains("locator("))
            return "Css";
        if (line.Contains("GetByPlaceholder") || line.Contains("getByPlaceholder"))
            return "Placeholder";
        if (line.Contains("GetByTestId") || line.Contains("getByTestId"))
            return "TestId";
        if (line.Contains("GetByAltText") || line.Contains("getByAltText"))
            return "AltText";
        if (line.Contains("GetByTitle") || line.Contains("getByTitle"))
            return "Title";

        return string.Empty;
    }

    private static string ExtractInputValue(string line)
    {
        string[] markers =
        [
            "FillAsync(",
            "fill(",
            "SelectOptionAsync(",
            "selectOption(",
            "PressAsync(",
            "press(",
            "GotoAsync(",
            "goto(",
            "setInputFiles(",
            "SetInputFilesAsync(",
            "dragTo(",
            "DragToAsync(",
            "keyboard.press(",
            "keyboard.type(",
            "keyboard.insertText(",
            "keyboard.down(",
            "keyboard.up(",
            "Keyboard.PressAsync(",
            "Keyboard.TypeAsync(",
            "Keyboard.InsertTextAsync(",
            "Keyboard.DownAsync(",
            "Keyboard.UpAsync(",
            "mouse.click(",
            "Mouse.ClickAsync(",
            "mouse.move(",
            "Mouse.MoveAsync(",
            "mouse.wheel(",
            "Mouse.WheelAsync(",
            "mouse.down(",
            "Mouse.DownAsync(",
            "mouse.up(",
            "Mouse.UpAsync("
        ];

        int start = -1;
        int markerLength = 0;

        foreach (string marker in markers)
        {
            int index = line.IndexOf(marker, StringComparison.Ordinal);
            if (index < 0)
            {
                continue;
            }

            if (start < 0 || index < start)
            {
                start = index;
                markerLength = marker.Length;
            }
        }

        if (start < 0)
        {
            return string.Empty;
        }

        string remainder = line[(start + markerLength)..];
        string firstArgument = ExtractFirstArgument(remainder);
        return firstArgument.Trim();
    }

    private static string ResolveInputValue(
        string rawValue,
        IReadOnlyDictionary<string, string> variables,
        out string variableName)
    {
        variableName = string.Empty;
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return string.Empty;
        }

        string trimmed = rawValue.Trim();
        if (IsQuoted(trimmed))
        {
            return Unquote(trimmed);
        }

        if (variables.TryGetValue(trimmed, out string? resolved))
        {
            variableName = trimmed;
            return resolved;
        }

        if (Regex.IsMatch(trimmed, @"^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.CultureInvariant))
        {
            variableName = trimmed;
        }

        return trimmed;
    }

    private static string ExtractFirstArgument(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        int parenthesesDepth = 0;
        int bracesDepth = 0;
        int bracketsDepth = 0;
        bool inSingleQuote = false;
        bool inDoubleQuote = false;

        for (int i = 0; i < input.Length; i++)
        {
            char ch = input[i];
            char prev = i > 0 ? input[i - 1] : '\0';

            if (ch == '\'' && !inDoubleQuote && prev != '\\')
            {
                inSingleQuote = !inSingleQuote;
                continue;
            }

            if (ch == '"' && !inSingleQuote && prev != '\\')
            {
                inDoubleQuote = !inDoubleQuote;
                continue;
            }

            if (inSingleQuote || inDoubleQuote)
            {
                continue;
            }

            switch (ch)
            {
                case '(':
                    parenthesesDepth++;
                    break;
                case ')':
                    if (parenthesesDepth == 0 && bracesDepth == 0 && bracketsDepth == 0)
                    {
                        return input[..i].Trim();
                    }

                    parenthesesDepth = Math.Max(0, parenthesesDepth - 1);
                    break;
                case '{':
                    bracesDepth++;
                    break;
                case '}':
                    bracesDepth = Math.Max(0, bracesDepth - 1);
                    break;
                case '[':
                    bracketsDepth++;
                    break;
                case ']':
                    bracketsDepth = Math.Max(0, bracketsDepth - 1);
                    break;
                case ',':
                    if (parenthesesDepth == 0 && bracesDepth == 0 && bracketsDepth == 0)
                    {
                        return input[..i].Trim();
                    }

                    break;
            }
        }

        return input.Trim().TrimEnd(')', ';');
    }

    private static void TrackPopupVariables(
        string line,
        IDictionary<string, string> popupPromiseByWindow,
        ISet<string> popupWindows)
    {
        if (!string.IsNullOrWhiteSpace(ExtractPopupPromiseVariable(line)))
        {
            string popupPromiseVariable = ExtractPopupPromiseVariable(line);
            string popupWindow = popupPromiseVariable.EndsWith("Promise", StringComparison.OrdinalIgnoreCase)
                ? popupPromiseVariable[..^"Promise".Length]
                : popupPromiseVariable;

            if (!string.IsNullOrWhiteSpace(popupWindow))
            {
                popupPromiseByWindow[popupPromiseVariable] = popupWindow;
                popupWindows.Add(popupWindow);
            }
        }

        string assignedVariable = ExtractAssignedVariable(line);
        if (string.IsNullOrWhiteSpace(assignedVariable))
        {
            return;
        }

        Match promiseAwaitMatch = Regex.Match(
            line,
            @"await\s+([A-Za-z_][A-Za-z0-9_]*)",
            RegexOptions.CultureInvariant);

        if (!promiseAwaitMatch.Success)
        {
            return;
        }

        string awaited = promiseAwaitMatch.Groups[1].Value;
        if (popupPromiseByWindow.TryGetValue(awaited, out string? popupWindowName)
            && !string.IsNullOrWhiteSpace(popupWindowName))
        {
            popupWindows.Add(assignedVariable);
            popupPromiseByWindow[assignedVariable] = popupWindowName;
        }
    }

    private static void TrackVariables(string line, IDictionary<string, string> variables)
    {
        Match match = Regex.Match(
            line,
            @"^\s*(?:const|let|var|string|int|long|double|decimal|bool|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?);\s*$",
            RegexOptions.CultureInvariant);

        if (!match.Success)
        {
            return;
        }

        string variableName = match.Groups[1].Value;
        string rhs = match.Groups[2].Value.Trim();

        string value = rhs;
        if (IsQuoted(rhs))
        {
            value = Unquote(rhs);
        }

        variables[variableName] = value;
    }

    private static string ResolvePopupWindow(
        string line,
        string pageName,
        IReadOnlyDictionary<string, string> popupPromiseByWindow,
        IReadOnlySet<string> popupWindows)
    {
        if (IsPopup(line))
        {
            string popupPromiseVariable = ExtractPopupPromiseVariable(line);
            if (!string.IsNullOrWhiteSpace(popupPromiseVariable)
                && popupPromiseByWindow.TryGetValue(popupPromiseVariable, out string? popupWindow))
            {
                return popupWindow;
            }
        }

        if (!string.IsNullOrWhiteSpace(pageName) && popupWindows.Contains(pageName))
        {
            return pageName;
        }

        return string.Empty;
    }

    private static string ExtractPopupPromiseVariable(string line)
    {
        if (!line.Contains("waitForEvent('popup'", StringComparison.Ordinal)
            && !line.Contains("waitForEvent(\"popup\"", StringComparison.Ordinal)
            && !line.Contains("waitForPopup(", StringComparison.Ordinal))
        {
            return string.Empty;
        }

        string assigned = ExtractAssignedVariable(line);
        return assigned;
    }

    private static string ExtractAssignedVariable(string line)
    {
        Match match = Regex.Match(
            line,
            @"^\s*(?:const|let|var|[A-Za-z_][A-Za-z0-9_<>\[\]\?]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=",
            RegexOptions.CultureInvariant);

        if (!match.Success)
        {
            return string.Empty;
        }

        return match.Groups[1].Value;
    }

    private static string ExtractPageVariable(string line)
    {
        Match match = Regex.Match(
            line,
            @"\b([A-Za-z_][A-Za-z0-9_]*)\s*\.",
            RegexOptions.CultureInvariant);

        if (!match.Success)
        {
            return string.Empty;
        }

        string candidate = match.Groups[1].Value;
        return IsPageLikeVariable(candidate) ? candidate : string.Empty;
    }

    private static bool IsPageLikeVariable(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return Regex.IsMatch(value, @"^(page\d*|popup\d*|frame\d*)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }

    private static string ExtractLocatorChain(string line)
    {
        string[] markers =
        [
            "getByRole(", "GetByRole(",
            "getByText(", "GetByText(",
            "getByLabel(", "GetByLabel(",
            "locator(", "Locator(",
            "frameLocator(", "FrameLocator(",
            "getByPlaceholder(", "GetByPlaceholder(",
            "getByTestId(", "GetByTestId(",
            "getByAltText(", "GetByAltText(",
            "getByTitle(", "GetByTitle("
        ];

        int start = -1;
        foreach (string marker in markers)
        {
            int index = line.IndexOf(marker, StringComparison.Ordinal);
            if (index < 0)
            {
                continue;
            }

            if (start < 0 || index < start)
            {
                start = index;
            }
        }

        if (start < 0)
        {
            return string.Empty;
        }

        return line[start..].Trim().TrimEnd(';');
    }

    private static string ExtractLocatorValue(string locatorChain, string locatorType)
    {
        if (string.IsNullOrWhiteSpace(locatorChain))
        {
            return string.Empty;
        }

        string[] locatorMethods =
        [
            "getByRole(", "GetByRole(",
            "getByText(", "GetByText(",
            "getByLabel(", "GetByLabel(",
            "locator(", "Locator(",
            "frameLocator(", "FrameLocator(",
            "getByPlaceholder(", "GetByPlaceholder(",
            "getByTestId(", "GetByTestId(",
            "getByAltText(", "GetByAltText(",
            "getByTitle(", "GetByTitle("
        ];

        foreach (string method in locatorMethods)
        {
            string call = TryExtractMethodCall(locatorChain, method);
            if (string.IsNullOrWhiteSpace(call))
            {
                continue;
            }

            if (locatorType == "Css" || locatorType == "Frame")
            {
                int open = call.IndexOf('(');
                if (open >= 0)
                {
                    string arg = ExtractFirstArgument(call[(open + 1)..]);
                    if (IsQuoted(arg))
                    {
                        return Unquote(arg.Trim());
                    }
                }
            }

            return call;
        }

        return locatorChain;
    }

    private static string ExtractLocatorExpression(string locatorChain)
    {
        if (string.IsNullOrWhiteSpace(locatorChain))
        {
            return string.Empty;
        }

        string[] locatorMethods =
        [
            "getByRole(", "GetByRole(",
            "getByText(", "GetByText(",
            "getByLabel(", "GetByLabel(",
            "locator(", "Locator(",
            "frameLocator(", "FrameLocator(",
            "getByPlaceholder(", "GetByPlaceholder(",
            "getByTestId(", "GetByTestId(",
            "getByAltText(", "GetByAltText(",
            "getByTitle(", "GetByTitle(",
            "getById(", "GetById(",
            "getByName(", "GetByName("
        ];

        foreach (string method in locatorMethods)
        {
            string call = TryExtractMethodCall(locatorChain, method);
            if (string.IsNullOrWhiteSpace(call))
            {
                continue;
            }

            int open = call.IndexOf('(');
            string methodName = open > 0 ? call[..open] : call;
            if (string.IsNullOrWhiteSpace(methodName))
            {
                return string.Empty;
            }

            return char.ToLowerInvariant(methodName[0]) + methodName[1..] + "()";
        }

        return string.Empty;
    }

    private static string ExtractLocatorArgument(string locatorChain, string locatorExpression)
    {
        if (string.IsNullOrWhiteSpace(locatorChain) || string.IsNullOrWhiteSpace(locatorExpression))
        {
            return string.Empty;
        }

        string methodName = locatorExpression[..^2];
        string[] methodVariants = [methodName + "(", char.ToUpperInvariant(methodName[0]) + methodName[1..] + "("];

        foreach (string variant in methodVariants)
        {
            string call = TryExtractMethodCall(locatorChain, variant);
            if (string.IsNullOrWhiteSpace(call))
            {
                continue;
            }

            int open = call.IndexOf('(');
            if (open < 0)
            {
                continue;
            }

            string arg = ExtractFirstArgument(call[(open + 1)..]).Trim();
            if (IsQuoted(arg))
            {
                arg = Unquote(arg);
            }

            if (methodName.Equals("getByRole", StringComparison.OrdinalIgnoreCase))
            {
                int dot = arg.LastIndexOf(".", StringComparison.Ordinal);
                if (dot >= 0 && dot < arg.Length - 1)
                {
                    arg = arg[(dot + 1)..];
                }

                if (!string.IsNullOrWhiteSpace(arg))
                {
                    arg = char.ToLowerInvariant(arg[0]) + arg[1..];
                }
            }

            return arg;
        }

        return string.Empty;
    }

    private static string ExtractFrameName(string locatorChain)
    {
        if (string.IsNullOrWhiteSpace(locatorChain))
        {
            return string.Empty;
        }

        string call = TryExtractMethodCall(locatorChain, "frameLocator(");
        if (string.IsNullOrWhiteSpace(call))
        {
            call = TryExtractMethodCall(locatorChain, "FrameLocator(");
        }

        if (string.IsNullOrWhiteSpace(call))
        {
            return string.Empty;
        }

        int open = call.IndexOf('(');
        if (open < 0)
        {
            return string.Empty;
        }

        string arg = ExtractFirstArgument(call[(open + 1)..]);
        return IsQuoted(arg) ? Unquote(arg.Trim()) : arg.Trim();
    }

    private static string TryExtractMethodCall(string input, string methodMarker)
    {
        int start = input.IndexOf(methodMarker, StringComparison.Ordinal);
        if (start < 0)
        {
            return string.Empty;
        }

        int openParen = start + methodMarker.Length - 1;
        int depth = 0;
        bool inSingleQuote = false;
        bool inDoubleQuote = false;

        for (int i = openParen; i < input.Length; i++)
        {
            char ch = input[i];
            char prev = i > 0 ? input[i - 1] : '\0';

            if (ch == '\'' && !inDoubleQuote && prev != '\\')
            {
                inSingleQuote = !inSingleQuote;
                continue;
            }

            if (ch == '"' && !inSingleQuote && prev != '\\')
            {
                inDoubleQuote = !inDoubleQuote;
                continue;
            }

            if (inSingleQuote || inDoubleQuote)
            {
                continue;
            }

            if (ch == '(')
            {
                depth++;
                continue;
            }

            if (ch == ')')
            {
                depth--;
                if (depth == 0)
                {
                    return input[start..(i + 1)].Trim();
                }
            }
        }

        return string.Empty;
    }

    private static bool IsQuoted(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length < 2)
        {
            return false;
        }

        return (value[0] == '"' && value[^1] == '"')
            || (value[0] == '\'' && value[^1] == '\'');
    }

    private static string Unquote(string value)
    {
        if (!IsQuoted(value))
        {
            return value;
        }

        return value[1..^1];
    }

    private static bool ContainsAnyIgnoreCase(string line, params string[] tokens)
    {
        foreach (string token in tokens)
        {
            if (line.Contains(token, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
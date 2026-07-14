using System.Text.RegularExpressions;

namespace AutomationFrameWork.Utilities
{
    public class StringUtility
    {
        public bool IsNullOrEmpty(string input)
        {
            return string.IsNullOrEmpty(input);
        }

        public bool IsNullOrWhiteSpace(string input)
        {
            return string.IsNullOrWhiteSpace(input);
        }

        public bool Contains(string source, string value, bool ignoreCase = true)
        {
            if (source == null || value == null)
                return false;

            return ignoreCase
                ? source.IndexOf(value, StringComparison.OrdinalIgnoreCase) >= 0
                : source.Contains(value);
        }

        public bool Equals(string source, string value, bool ignoreCase = true)
        {
            if (source == null || value == null)
                return false;

            return string.Equals(source, value,
                ignoreCase ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
        }

        public bool StartsWith(string source, string value, bool ignoreCase = true)
        {
            if (source == null || value == null)
                return false;

            return source.StartsWith(value,
                ignoreCase ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
        }

        public bool EndsWith(string source, string value, bool ignoreCase = true)
        {
            if (source == null || value == null)
                return false;

            return source.EndsWith(value,
                ignoreCase ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
        }

        public List<string> SplitByWord(string source, string word)
        {
            if (IsNullOrEmpty(source) || IsNullOrEmpty(word))
                return new List<string>();

            return source.Split(new string[] { word }, StringSplitOptions.None).ToList();
        }

        public List<string> SplitByChar(string source, char separator)
        {
            if (IsNullOrEmpty(source))
                return new List<string>();

            return source.Split(separator).ToList();
        }

        public List<string> SplitByRegex(string source, string pattern)
        {
            if (IsNullOrEmpty(source))
                return new List<string>();

            return Regex.Split(source, pattern).ToList();
        }

        public bool WordExists(string source, string word)
        {
            if (IsNullOrEmpty(source) || IsNullOrEmpty(word))
                return false;

            return Regex.IsMatch(source, $@"\b{Regex.Escape(word)}\b",
                RegexOptions.IgnoreCase);
        }

        public int CountWordOccurrences(string source, string word)
        {
            if (IsNullOrEmpty(source) || IsNullOrEmpty(word))
                return 0;

            return Regex.Matches(source, Regex.Escape(word),
                RegexOptions.IgnoreCase).Count;
        }

        public string RemoveWord(string source, string word)
        {
            if (IsNullOrEmpty(source) || IsNullOrEmpty(word))
                return source;

            return Regex.Replace(source, $@"\b{Regex.Escape(word)}\b", "",
                RegexOptions.IgnoreCase).Trim();
        }

        public string Replace(string source, string oldValue, string newValue, bool ignoreCase = true)
        {
            if (IsNullOrEmpty(source) || IsNullOrEmpty(oldValue))
                return source;

            return ignoreCase
                ? Regex.Replace(source, Regex.Escape(oldValue), newValue,
                    RegexOptions.IgnoreCase)
                : source.Replace(oldValue, newValue);
        }

        public List<string> ExtractNumbers(string source)
        {
            if (IsNullOrEmpty(source))
                return new List<string>();

            return Regex.Matches(source, @"\d+")
                        .Cast<Match>()
                        .Select(m => m.Value)
                        .ToList();
        }

        public  List<string> ExtractByRegex(string source, string pattern)
        {
            if (IsNullOrEmpty(source))
                return new List<string>();

            return Regex.Matches(source, pattern)
                        .Cast<Match>()
                        .Select(m => m.Value)
                        .ToList();
        }

        public string ToUpper(string source)
        {
            return source?.ToUpper();
        }

        public string ToLower(string source)
        {
            return source?.ToLower();
        }

        public string Trim(string source)
        {
            return source?.Trim();
        }

        public string Reverse(string source)
        {
            if (IsNullOrEmpty(source))
                return source;

            return new string(source.Reverse().ToArray());
        }

        public string RemoveSpecialCharacters(string source)
        {
            if (IsNullOrEmpty(source))
                return source;

            return Regex.Replace(source, @"[^a-zA-Z0-9\s]", "");
        }

        public int SafeParseInt(string source, int defaultValue = 0)
        {
            return int.TryParse(source, out int result)
                ? result
                : defaultValue;
        }

        public double SafeParseDouble(string source, double defaultValue = 0.0)
        {
            return double.TryParse(source, out double result)
                ? result
                : defaultValue;
        }
    }
}

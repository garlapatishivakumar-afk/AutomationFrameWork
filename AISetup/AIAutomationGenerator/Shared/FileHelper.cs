namespace AIAutomationGenerator.Shared;

public static class FileHelper
{
    public static IEnumerable<string> GetFiles(string root, string pattern)
    {
        if (!Directory.Exists(root))
            return Enumerable.Empty<string>();

        return EnumerateFiles(root, pattern);
    }

    private static IEnumerable<string> EnumerateFiles(string directory, string pattern)
    {
        IEnumerable<string> files;
        try
        {
            files = Directory.EnumerateFiles(directory, pattern, SearchOption.TopDirectoryOnly);
        }
        catch (UnauthorizedAccessException)
        {
            yield break;
        }
        catch (DirectoryNotFoundException)
        {
            yield break;
        }

        foreach (string file in files)
            yield return file;

        IEnumerable<string> directories;
        try
        {
            directories = Directory.EnumerateDirectories(directory);
        }
        catch (UnauthorizedAccessException)
        {
            yield break;
        }
        catch (DirectoryNotFoundException)
        {
            yield break;
        }

        foreach (string childDirectory in directories)
        {
            foreach (string file in EnumerateFiles(childDirectory, pattern))
                yield return file;
        }
    }
}
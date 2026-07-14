using System.Globalization;
using AutomationFrameWork.Drivers;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;

namespace AutomationFrameWork.Pages
{
    public class CommonActionsPage
    {
        private readonly IPage _page;
        public string ProjectRoot;
        private const float ShortWait = 1;
        private const float MediumWait = 2;
        private const float LongWait = 3;

        public CommonActionsPage(IPage page)
        {
            _page = page ?? throw new ArgumentNullException(nameof(page));
            ProjectRoot = GetProjectRoot();
        }

        public async Task NavigateToURLAsync(String url)
        {
            if (!PlaywrightDriver.HasSavedSession())
            {
                await ClearBrowserCache();
                Console.WriteLine("[Session] No saved session - cache cleared for fresh login.");
            }
            else
            {
                Console.WriteLine("[Session] Saved session detected - skipping cache clear.");
            }

            await _page.GotoAsync(url);

            if (!PlaywrightDriver.HasSavedSession())
                await WaitAsync(25);
        }

        public async Task WaitAsync(float seconds)
        {
            if (seconds > 0)
            {
                await _page.WaitForTimeoutAsync(seconds * 1000);
            }
        }

        public async Task WaitAsync(string waitType)
        {
            switch (waitType.ToLower())
            {
                case "short":
                    await _page.WaitForTimeoutAsync(ShortWait * 1000);
                    break;
                case "medium":
                    await _page.WaitForTimeoutAsync(MediumWait * 1000);
                    break;
                case "long":
                    await _page.WaitForTimeoutAsync(LongWait * 1000);
                    break;
                default:
                    throw new ArgumentException($"Invalid wait type: {waitType}. Use 'short', 'medium', or 'long'.");
            }
        }

        public void LogCurrentPageUrl()
        {
            var currentUrl = _page.Url;
            Console.WriteLine("** Navigated to the URL : " + currentUrl);
        }

        public static string GetProjectRoot()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);

            while (directory != null && !directory.GetFiles("*.csproj").Any())
            {
                directory = directory.Parent;
            }

            if (directory == null)
                throw new DirectoryNotFoundException("Could not find project root (.csproj)");

            return directory.FullName;
        }

        public string GetProjectRootPath()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);

            while (directory != null && !directory.GetFiles("*.csproj").Any())
            {
                directory = directory.Parent;
            }

            if (directory == null)
                throw new DirectoryNotFoundException("Could not find project root (.csproj)");

            return directory.FullName;
        }

        public async Task ClearBrowserCache()
        {
            // Clear storage (localStorage, sessionStorage, IndexedDB)
            await _page.EvaluateAsync(@"() => {
            try {
                localStorage.clear();
                sessionStorage.clear();
                
                // Clear IndexedDB databases
                if (window.indexedDB) {
                    window.indexedDB.databases().then(databases => {
                        databases.forEach(db => {
                            window.indexedDB.deleteDatabase(db.name);
                        });
                    });
                }
                
                // Clear cache storage if available
                if ('caches' in window) {
                    caches.keys().then(keyList => {
                        return Promise.all(keyList.map(key => {
                            return caches.delete(key);
                        }));
                    });
                }
            } catch(e) {
                console.error('Error clearing storage:', e);
            }
        }");

            // Optional: Clear service workers
            await _page.EvaluateAsync(@"() => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => {
                        registration.unregister();
                    });
                });
            }
        }");
        }

        public void DeleteExistingFilesInFileDownloadsFolder()
        {
            // Use GetProjectRoot() to set download folder at project root
            var downloadDirectory = Path.Combine(GetProjectRootPath(), "FileDownloads");
            Directory.CreateDirectory(downloadDirectory);

            // Clear any existing files in the folder before downloading
            foreach (var existingFile in Directory.GetFiles(downloadDirectory))
            {
                File.Delete(existingFile);
                Console.WriteLine($" Deleted existing file: {Path.GetFileName(existingFile)}");
            }
        }

        public async Task VerifyLetterDownloadFunctionality(string Id)
        {
            // Use GetProjectRoot() to set download folder at project root
            var downloadDirectory = Path.Combine(GetProjectRootPath(), "FileDownloads");
            Directory.CreateDirectory(downloadDirectory);

            var downloadTask = _page.WaitForDownloadAsync();
            var download = await downloadTask;
            var downloadedFilePath = Path.Combine(downloadDirectory, download.SuggestedFilename);
            await download.SaveAsAsync(downloadedFilePath);
            try
            {
                if (!File.Exists(downloadedFilePath))
                    throw new Exception($"Download failed: File not found at '{downloadedFilePath}'.");

                if (!Path.GetExtension(downloadedFilePath).Equals(".pdf", StringComparison.OrdinalIgnoreCase))
                    throw new Exception($"Expected a .pdf file but got: '{Path.GetExtension(downloadedFilePath)}'.");

                if (new FileInfo(downloadedFilePath).Length == 0)
                    throw new Exception("Downloaded PDF is empty or corrupt.");

                if (!download.SuggestedFilename.Contains(Id, StringComparison.OrdinalIgnoreCase))
                    throw new Exception($"Downloaded file '{download.SuggestedFilename}' does not contain the expected loan ID '{Id}'.");
                else
                    Console.WriteLine($"Filename check passed: {download.SuggestedFilename} contains '{Id}'.");

                Console.WriteLine($"Download verified: {download.SuggestedFilename}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Download verification failed: {ex.Message}");
                throw; // Rethrow to ensure test failure is captured in reports
            }
            finally
            {
                if (File.Exists(downloadedFilePath))
                {
                    File.Delete(downloadedFilePath);
                    Console.WriteLine($" Cleaned up: {downloadedFilePath}");
                }
            }
        }

        public bool IsAscending(List<int> numbers)
        {
            for (int i = 0; i < numbers.Count - 1; i++)
            {
                if (numbers[i] > numbers[i + 1])
                {
                    return false;
                }
            }
            return true;
        }

        public bool IsDescending(List<int> numbers)
        {
            for (int i = 0; i < numbers.Count - 1; i++)
            {
                if (numbers[i] < numbers[i + 1])
                {
                    return false;
                }
            }
            return true;
        }

        public bool IsAscendingDates(List<DateTime> dates)
        {
            for (int i = 0; i < dates.Count - 1; i++)
            {
                if (dates[i] > dates[i + 1])
                {
                    return false;
                }
            }
            return true;
        }

        public bool IsDescendingDates(List<DateTime> dates)
        {
            for (int i = 0; i < dates.Count - 1; i++)
            {
                if (dates[i] < dates[i + 1])
                {
                    return false;
                }
            }
            return true;
        }

        public async Task<List<int>> GetElementIntValuesAsync(ILocator locator)
        {
            var elements = await locator.AllTextContentsAsync();

            var result = new List<int>();

            foreach (var text in elements)
            {
                if (int.TryParse(text.Trim().Replace(",", ""), out int value))
                {
                    result.Add(value);
                }
            }

            return result;
        }

        public async Task<List<DateTime>> GetElementDateTimeValuesAsync(ILocator locator)
        {
            var elements = await locator.AllTextContentsAsync();

            var result = new List<DateTime>();

            foreach (var text in elements)
            {
                if (DateTime.TryParseExact(
                        text.Trim(),
                        "M/d/yyyy h:mm:ss tt",
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.None,
                        out DateTime value))
                {
                    result.Add(value);
                }
            }

            return result;
        }

        public async Task ValidatePageTitle()
        {
            string title = await _page.TitleAsync();
            if (title.Trim().Contains("Document Generation - "))
            {
                Console.WriteLine($"Page title is displayed as Expected : {title}");
            }
            else
            {
                throw new Exception($"Page title is not as expected. Actual page title is : {title}");
            }
        }

        public async Task ValidateIntColumnSortingAsync(ILocator header, ILocator data, string columnName)
        {
            await header.ClickAsync();
            await WaitAsync("medium");
            var ascending = await GetElementIntValuesAsync(data);
            Assert.True(ascending.Count > 0, $"{columnName}: No valid date values found for sorting validation.");
            Assert.True(IsAscending(ascending), $"{columnName}: Expected ascending order.");

            await header.ClickAsync();
            await WaitAsync("medium");
            var descending = await GetElementIntValuesAsync(data);
            Assert.True(descending.Count > 0, $"{columnName}: No valid date values found for sorting validation.");
            Assert.True(IsDescending(descending), $"{columnName}: Expected descending order.");

            Console.WriteLine($"{columnName} column sort validation passed.");
        }

        public async Task ValidateDateColumnSortingAsync(ILocator header, ILocator data, string columnName)
        {
            await header.ClickAsync();
            await WaitAsync("medium");
            var ascending = await GetElementDateTimeValuesAsync(data);
            Assert.True(ascending.Count > 0, $"{columnName}: No valid date values found for sorting validation.");
            Assert.True(IsAscendingDates(ascending), $"{columnName}: Expected ascending order.");

            await header.ClickAsync();
            await WaitAsync("medium");
            var descending = await GetElementDateTimeValuesAsync(data);
            Assert.True(descending.Count > 0, $"{columnName}: No valid date values found for sorting validation.");
            Assert.True(IsDescendingDates(descending), $"{columnName}: Expected descending order.");

            Console.WriteLine($"{columnName} column sort validation passed.");
        }


    }
}

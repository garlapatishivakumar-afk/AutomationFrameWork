using AutomationFrameWork.Pages;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;
using System.Text.Json;

namespace AutomationFrameWork.Drivers
{
    public class PlaywrightDriver
    {
        public IPlaywright Playwright { get; private set; }
        public IBrowser Browser { get; private set; }
        public IBrowserContext BrowserContext { get; private set; }
        public IPage Page { get; private set; }

        private readonly ScenarioContext _scenarioContext;

        // --- Session file paths ---
        private static string SessionStatePath =>
            Path.Combine(CommonActionsPage.GetProjectRoot(), "browser-session", "session-state.json");

        // NEW: Metadata file tracks when the session was saved
        private static string SessionMetaPath =>
            Path.Combine(CommonActionsPage.GetProjectRoot(), "browser-session", "session-meta.json");

        // NEW: Re-authenticate if session is older than 23 hours (buffer before 24hr server expiry)
        private static readonly TimeSpan SessionMaxAge = TimeSpan.FromHours(23);

        public PlaywrightDriver(ScenarioContext scenarioContext)
        {
            _scenarioContext = scenarioContext;
        }

        public async Task InitializeAsync()
        {
            Playwright = await Microsoft.Playwright.Playwright.CreateAsync();

            var config = _scenarioContext.Get<ConfigReader>("ConfigReader");

            // NEW: Use the combined validity check instead of just File.Exists
            bool sessionExists = IsSessionValid();

            var launchOptions = new BrowserTypeLaunchOptions
            {
                Headless = config.AutomationSettings.Headless,
                //Args = new[] { "--start-maximized" }
                Args = new[]
                {
                    $"--window-size={config.AutomationSettings.targetWidth},{config.AutomationSettings.targetHeight}",  // works in BOTH headed & headless
                    // "--start-maximized"                             // still useful for headed mode
                }
            };

            string browserName = config.AutomationSettings.Browser?.ToLower();

            if (!string.IsNullOrWhiteSpace(browserName))
            {
                switch (browserName)
                {
                    case "chrome":
                        launchOptions.ExecutablePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
                        Browser = await Playwright.Chromium.LaunchAsync(launchOptions);
                        break;
                    case "msedge":
                        launchOptions.Channel = "msedge";
                        Browser = await Playwright.Chromium.LaunchAsync(launchOptions);
                        break;
                    case "chromium":
                        Browser = await Playwright.Chromium.LaunchAsync(launchOptions);
                        break;
                    case "firefox":
                        Browser = await Playwright.Firefox.LaunchAsync(launchOptions);
                        break;
                    case "webkit":
                        Browser = await Playwright.Webkit.LaunchAsync(launchOptions);
                        break;
                    default:
                        throw new ArgumentException($"Unsupported browser: {config.AutomationSettings.Browser}");
                }
            }

            var contextOptions = new BrowserNewContextOptions
            {
                ViewportSize = ViewportSize.NoViewport,
            };

            if (sessionExists)
            {
                Console.WriteLine($"[Session] Loading saved session from: {SessionStatePath}");
                contextOptions.StorageStatePath = SessionStatePath;
            }
            else
            {
                Console.WriteLine("[Session] No valid session found. A fresh login will be required.");
            }

            BrowserContext = await Browser.NewContextAsync(contextOptions);
            await BrowserContext.Tracing.StartAsync(new()
            {
                Screenshots = true,
                Snapshots = true,
                Sources = true
            });

            if (!sessionExists)
            {
                await BrowserContext.ClearCookiesAsync();
                await BrowserContext.ClearPermissionsAsync();
            }

            if (!sessionExists && browserName is "chrome" or "chromium" or "msedge")
            {
                var tempPage = await BrowserContext.NewPageAsync();
                var session = await BrowserContext.NewCDPSessionAsync(tempPage);
                await session.SendAsync("Network.enable");
                await session.SendAsync("Network.setCacheDisabled", new Dictionary<string, object>
                {
                    ["cacheDisabled"] = true
                });
                await tempPage.CloseAsync();
                Console.WriteLine("[Session] Cache disabled for fresh login run.");
            }

            BrowserContext.SetDefaultTimeout(config.AutomationSettings.Timeout);
            BrowserContext.SetDefaultNavigationTimeout(config.AutomationSettings.Timeout);

            Page = await BrowserContext.NewPageAsync();

            Console.WriteLine("-----------------------------------------------------------------------------------------------------------------------");

            var width = await Page.EvaluateAsync<int>("window.innerWidth");
            var height = await Page.EvaluateAsync<int>("window.innerHeight");
            Console.WriteLine($"[Browser] Launched with actual size: {width}x{height}");

            Console.WriteLine("-----------------------------------------------------------------------------------------------------------------------");

        }

        public async Task SaveSessionAsync()
        {
            if (BrowserContext == null)
            {
                Console.WriteLine("[Session] ERROR: BrowserContext is null, cannot save session.");
                return;
            }

            string sessionDir = Path.GetDirectoryName(SessionStatePath)!;
            Directory.CreateDirectory(sessionDir);

            await BrowserContext.StorageStateAsync(new BrowserContextStorageStateOptions
            {
                Path = SessionStatePath
            });

            if (File.Exists(SessionStatePath))
            {
                var fileInfo = new FileInfo(SessionStatePath);
                Console.WriteLine($"[Session] Saved successfully. Size: {fileInfo.Length} bytes");

                if (fileInfo.Length < 100)
                {
                    Console.WriteLine("[Session] WARNING: Session file is very small — cookies may not have been captured!");
                }
                else
                {
                    // NEW: Write metadata with current timestamp only if session file looks valid
                    var meta = new { SavedAt = DateTime.UtcNow };
                    File.WriteAllText(SessionMetaPath, JsonSerializer.Serialize(meta));
                    Console.WriteLine($"[Session] Metadata saved. Session will expire after {SessionMaxAge.TotalHours} hours.");
                }
            }
            else
            {
                Console.WriteLine("[Session] ERROR: File was not written to disk!");
            }
        }

        // NEW: Central validity check — replaces scattered File.Exists calls
        public static bool IsSessionValid()
        {
            // 1. Both files must exist
            if (!File.Exists(SessionStatePath) || !File.Exists(SessionMetaPath))
            {
                Console.WriteLine("[Session] Session or metadata file missing.");
                return false;
            }

            // 2. Check session file size (corrupt/empty guard)
            var fileInfo = new FileInfo(SessionStatePath);
            if (fileInfo.Length < 100)
            {
                Console.WriteLine("[Session] WARNING: Session file is empty/corrupt — invalidating.");
                InvalidateSession();
                return false;
            }

            // 3. Check session age via metadata
            try
            {
                var metaJson = File.ReadAllText(SessionMetaPath);
                var meta = JsonSerializer.Deserialize<JsonElement>(metaJson);
                var savedAt = meta.GetProperty("SavedAt").GetDateTime();
                var age = DateTime.UtcNow - savedAt;

                if (age > SessionMaxAge)
                {
                    Console.WriteLine($"[Session] Session expired — age: {age.TotalHours:F1} hrs (max: {SessionMaxAge.TotalHours} hrs). Will re-authenticate.");
                    InvalidateSession();
                    return false;
                }

                Console.WriteLine($"[Session] Session is valid — age: {age.TotalMinutes:F0} mins remaining: {(SessionMaxAge - age).TotalMinutes:F0} mins.");
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Session] Metadata read failed: {ex.Message} — invalidating.");
                InvalidateSession();
                return false;
            }
        }

        public static void InvalidateSession()
        {
            bool deleted = false;
            if (File.Exists(SessionStatePath))
            {
                File.Delete(SessionStatePath);
                deleted = true;
            }
            // NEW: Also clean up metadata
            if (File.Exists(SessionMetaPath))
            {
                File.Delete(SessionMetaPath);
                deleted = true;
            }

            if (deleted)
                Console.WriteLine("[Session] Session invalidated. Next run will re-authenticate.");
        }

        // Kept for backward compat but now delegates to IsSessionValid()
        public static bool HasSavedSession() => IsSessionValid();

        // NEW: Checks if the current page has been redirected to the login page
        // Used in AfterScenario to detect auth failures vs regular test failures
        public bool IsOnLoginPage()
        {
            try
            {
                var url = Page?.Url ?? string.Empty;
                // Adjust these patterns to match your app's login URL
                return url.Contains("/login", StringComparison.OrdinalIgnoreCase)
                    || url.Contains("/signin", StringComparison.OrdinalIgnoreCase)
                    || url.Contains("/auth", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        public async Task<bool> CheckIfLoggedInAsync()
        {
            try
            {
                var userElement = await Page.QuerySelectorAsync(
                    ".user-profile, .logout-button, [data-testid='user-menu']");
                return userElement != null;
            }
            catch
            {
                return false;
            }
        }

        public async Task StopTracingAsync(ScenarioContext scenarioContext)
        {
            if (BrowserContext == null) return;

            string scenarioName = scenarioContext.ScenarioInfo.Title;
            foreach (char invalidChar in Path.GetInvalidFileNameChars())
                scenarioName = scenarioName.Replace(invalidChar, '_');

            scenarioName = scenarioName.Replace(" ", "_");
            string timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            string projectRoot = CommonActionsPage.GetProjectRoot();
            string tracesDirectory = Path.Combine(projectRoot, "Traces");
            Directory.CreateDirectory(tracesDirectory);

            string tracePath = Path.Combine(tracesDirectory, $"{scenarioName}_{timestamp}.zip");

            await BrowserContext.Tracing.StopAsync(
                    new TracingStopOptions
                    {
                        Path = tracePath
                    });

            Console.WriteLine($"Playwright trace saved at: {tracePath}");
            Console.WriteLine("========== StopTracingAsync Called ==========");
        }

        public async Task CleanupAsync()
        {
            if (Page != null) await Page.CloseAsync();
            if (BrowserContext != null) await BrowserContext.CloseAsync();
            if (Browser != null) await Browser.CloseAsync();
            Playwright?.Dispose();
        }
    }
}
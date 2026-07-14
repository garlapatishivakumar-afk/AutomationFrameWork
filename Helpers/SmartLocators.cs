using Microsoft.Playwright;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

public class SmartLocators
{
    public async Task SmartClickAsync(IPage page, string locator, string locatorHTML)
    {
        try
        {
            await page.Locator(locator).ClickAsync(new() { Timeout = 3000 });
            Console.WriteLine("Original locator worked.");
        }
        catch
        {
            Console.WriteLine("Locator failed. Asking AI for correction...");

            string newLocator =
                await AiLocatorHelper.GetSmartLocatorAsync(locatorHTML, locator);

            if (string.IsNullOrEmpty(newLocator))
                throw new Exception("AI did not return valid locator.");

            Console.WriteLine($"AI Suggested Locator: {newLocator}");

            await page.Locator(newLocator).ClickAsync();
        }
    }

    public static class AiLocatorHelper
    {
        private static readonly HttpClient _client = new HttpClient();

        public static async Task<string> GetSmartLocatorAsync(string html, string failedLocator)
        {
            var value = " Please add your model access value here ";

            _client.DefaultRequestHeaders.Clear();
            _client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", value);

            var prompt = $"""
        The following locator failed to be identified on the DOM:
        {failedLocator}

        Here is the relevant HTML:
        {html}

        Suggest a better locator with unique details not like attribute containing some numbers which might change in future. 
        Note: Do not Include any additional text along with the locator string such as "```csharp\n etc..,".  
        Return ONLY the locator string. So that I can fetch and use it as a locator during runtime of my automation script.
        """;

            var requestBody = new
            {
                model = "gpt-4o-mini",
                messages = new[]
                {
                new { role = "user", content = prompt }
            },
                temperature = 0.2
            };
            
            var response = await _client.PostAsync(
                "https://api.openai.com/v1/chat/completions",
                new StringContent(JsonSerializer.Serialize(requestBody),
                Encoding.UTF8, "application/json"));

            Console.WriteLine("*** Response String From AI : " + response.ToString());

            var json = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"OpenAI API Error: {json}");
            }

            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("choices", out var choices))
            {
                throw new Exception($"Unexpected OpenAI response: {json}");
            }

            string newLocatorValue = choices[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString()
                ?.Trim();

            Console.WriteLine(newLocatorValue);

            return choices[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString()
                ?.Trim();
        }

    }
}

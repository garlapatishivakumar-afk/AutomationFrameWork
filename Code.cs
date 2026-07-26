using Microsoft.Playwright;

public class RecordedFlow
{
    public async Task RunAsync(IPage page)
    {
        await page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();
        await page.GetByLabel("Email").FillAsync("demo@example.com");
        await page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).ClickAsync();
    }
}

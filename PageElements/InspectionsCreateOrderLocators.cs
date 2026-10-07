using Microsoft.Playwright;

namespace AutomationFrameWork.PageElements
{
    public class InspectionsCreateOrderLocators
    {
        public ILocator CmbsLink(IPage page) =>
            page.GetByRole(AriaRole.Link, new() { Name = "CMBS", Exact = true });

        public ILocator CreateOrderLink(IPage page) =>
            page.GetByRole(AriaRole.Link, new() { Name = "Create Order", Exact = true });
    }
}

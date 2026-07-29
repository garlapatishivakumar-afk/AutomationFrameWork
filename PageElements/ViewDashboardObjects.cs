using Microsoft.Playwright;

namespace AutomationFrameWork.PageElements;

public class ViewDashboardObjects
{
    public ILocator AdministrationLink(IPage page) => page.GetByRole(AriaRole.Link, new() { Name = "Administration" });
    public ILocator ReassignPackagesLink(IPage page) => page.GetByRole(AriaRole.Link, new() { Name = "Reassign Packages" });
    public ILocator SearchUserDropdown(IPage page) => page.Locator("#ctl00_ContentPlaceHolder1_ddlSearchUser");
    public ILocator SearchQueueButton(IPage page) => page.GetByRole(AriaRole.Button, new() { Name = "Search Queue" });
    public ILocator FirstPackageCheckbox(IPage page) => page.Locator("#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox");
    public ILocator AssignUserDropdown(IPage page) => page.Locator("#ctl00_ContentPlaceHolder1_ddlUsers");
    public ILocator AssignToSelectedUserButton(IPage page) => page.GetByRole(AriaRole.Button, new() { Name = "Assign to Selected User" });
    public ILocator DashboardLink(IPage page) => page.GetByRole(AriaRole.Link, new() { Name = "Dashboard" });
    public ILocator PackageSourceDropdown(IPage page) => page.Locator("#ctl00_ContentPlaceHolder1_ddlPackageSource");
}
using System;
using System.Threading.Tasks;
using AutomationFrameWork.Utilities;
using Microsoft.Playwright;
using AutomationFrameWork.Pages;

namespace AutomationFrameWork.CodegenAI
{
    public sealed class CodegenRecordedFlow
    {
        private readonly CommonActionsPage _commonActions;

        public CodegenRecordedFlow(IPage page, ConfigReader config)
        {
            Page = page ?? throw new ArgumentNullException(nameof(page));
            Config = config ?? throw new ArgumentNullException(nameof(config));
            _commonActions = new CommonActionsPage(Page);
        }

        public IPage Page { get; }

        public ConfigReader Config { get; }

        public async Task ReplayAsync()
        {
            // Review: URL at source line uses literal value because no matching appsettings Urls entry was found: https://login.microsoftonline.com/0b14651e-5110-47c7-b458-14565f1d46de/oauth2/v2.0/authorize?response_type=code&client_id=0c480180-fae1-45b2-b898-ac1967301038&scope=openid%20profile%20email&state=djhERkeqhsURh-b9yBoJ6BPDO40UMWQgncbBTcNjGmM%3D&redirect_uri=https://app-cvw-ui-sit-eus2.ase-cms-sit-eus2-01.appserviceenvironment.net/cmsview/login/oauth2/code/azure&nonce=xQ6oKp2OgCefbRHt3Elnw8c1r-_R20EFZwXYrFu1mTI#/Role/ss/EntryPoint/deals
            await _commonActions.NavigateToURLAsync("https://login.microsoftonline.com/0b14651e-5110-47c7-b458-14565f1d46de/oauth2/v2.0/authorize?response_type=code&client_id=0c480180-fae1-45b2-b898-ac1967301038&scope=openid%20profile%20email&state=djhERkeqhsURh-b9yBoJ6BPDO40UMWQgncbBTcNjGmM%3D&redirect_uri=https://app-cvw-ui-sit-eus2.ase-cms-sit-eus2-01.appserviceenvironment.net/cmsview/login/oauth2/code/azure&nonce=xQ6oKp2OgCefbRHt3Elnw8c1r-_R20EFZwXYrFu1mTI#/Role/ss/EntryPoint/deals");
            // Review: URL at source line uses literal value because no matching appsettings Urls entry was found: https://login.microsoftonline.com/0b14651e-5110-47c7-b458-14565f1d46de/login
            await _commonActions.NavigateToURLAsync("https://login.microsoftonline.com/0b14651e-5110-47c7-b458-14565f1d46de/login");
        }
    }
}
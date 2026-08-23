# V2.1 Enhancement #1 - URL naming unit tests
# Dot-sources only UrlNamingFunctions.ps1 - the recorder CANNOT run from this script.
# Run: powershell -File AIRecorder\Test-UrlNaming.ps1

. "$PSScriptRoot\UrlNamingFunctions.ps1"

$script:failed = 0

function Assert-Equal {
	param($Expected, $Actual, $Label)
	if ($Expected -eq $Actual) {
		Write-Host "  PASS: $Label"
	}
	else {
		Write-Host "  FAIL: $Label  Expected=[$Expected]  Got=[$Actual]"
		$script:failed++
	}
}

Write-Host "`n--- Get-AppNameFromUrl ---"
Assert-Equal 'CashManagement'         (Get-AppNameFromUrl 'https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx')                              'CashManagement'
Assert-Equal 'InvestorReporting'      (Get-AppNameFromUrl 'https://investorreporting-mb-sit.trimont.com/IRDeals/DealsCompletionStatus.aspx')                      'InvestorReporting'
Assert-Equal 'DocumentAdministration' (Get-AppNameFromUrl 'https://documentadministration-uat.trimont.com/AttributionQueue.aspx')                                'DocumentAdministration'
Assert-Equal $null                    (Get-AppNameFromUrl 'https://login.microsoftonline.com/0b14651e-5110-47c7-b458-14565f1d46de/login')                        'MicrosoftLogin_excluded'
Assert-Equal $null                    (Get-AppNameFromUrl 'https://someunknown-sit.trimont.com/SomePage.aspx')                                                   'UnknownApp_excluded'

Write-Host "`n--- Get-PageNameFromUrl ---"
Assert-Equal 'WorkQueue'              (Get-PageNameFromUrl 'https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx')                             'dg_prefix_stripped'
Assert-Equal 'Whoiam'                 (Get-PageNameFromUrl 'https://cashmanagement-sit.trimont.com/Whoiam.aspx')                                                  'Whoiam'
Assert-Equal 'DealsCompletionStatus'  (Get-PageNameFromUrl 'https://investorreporting-mb-sit.trimont.com/IRDeals/DealsCompletionStatus.aspx')                     'DealsCompletionStatus'
Assert-Equal 'DealReportDetailNew'    (Get-PageNameFromUrl 'https://investorreporting-mb-sit.trimont.com/IRDeals/DealReportDetailNew.aspx?rpt=NTORCashActionForm') 'QueryString_ignored'
Assert-Equal 'AttributionQueue'       (Get-PageNameFromUrl 'https://documentadministration-uat.trimont.com/AttributionQueue.aspx')                               'AttributionQueue'
Assert-Equal 'Default'                (Get-PageNameFromUrl 'https://documentadministration-uat.trimont.com/Default.aspx')                                        'Default'
Assert-Equal $null                    (Get-PageNameFromUrl 'https://documentadministration-uat.trimont.com/')                                                    'RootPath_excluded'
Assert-Equal 'Login'                  (Get-PageNameFromUrl 'https://login.microsoftonline.com/0b14651e-5110-47c7-b458-14565f1d46de/login')                       'MicrosoftLogin_page_returns_Login_appName_guards_semantic_skip'

Write-Host "`n--- Set-RecordedApplication (idempotent) ---"
$fakeConfig = [pscustomobject]@{
	Urls = [pscustomobject]@{
		Applications = [pscustomobject]@{}
	}
}
Set-RecordedApplication -Config $fakeConfig -AppName 'CashManagement' -PageName 'WorkQueue' -Url 'https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx'
Assert-Equal 'https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx' `
	$fakeConfig.Urls.Applications.RecordedApplications.CashManagement.WorkQueue `
	'SemanticEntry_created'

# Run again to verify idempotency
Set-RecordedApplication -Config $fakeConfig -AppName 'CashManagement' -PageName 'WorkQueue' -Url 'https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx'
Assert-Equal 'https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx' `
	$fakeConfig.Urls.Applications.RecordedApplications.CashManagement.WorkQueue `
	'SemanticEntry_idempotent'

Write-Host ""
if ($script:failed -gt 0) {
	Write-Host "Result: $($script:failed) test(s) FAILED"
	exit 1
}
else {
	Write-Host "Result: All tests PASSED"
}

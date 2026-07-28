using AIAutomationGenerator.Configuration;
using AIAutomationGenerator.Interfaces;

namespace AIAutomationGenerator.FrameworkScanner;

public static class ScannerFactory
{
    public static IReadOnlyList<IRepositoryScanner> CreateScanners(
        ScannerSettings settings,IFeatureParser featureParser,ILogger logger)
    {
        List<IRepositoryScanner> scanners = [];
        if (settings.ScanFeatures)scanners.Add(new FeatureScanner(featureParser, logger));
        if (settings.ScanPageMethods)scanners.Add(new MethodScanner(new MethodParser(),logger));
        if (settings.ScanPageObjects) scanners.Add(new LocatorScanner(new LocatorParser(), logger));
        if (settings.ScanStepDefinitions) scanners.Add(new StepDefinitionScanner(new StepDefinitionParser(), logger));
        if (settings.ScanUtilities) scanners.Add(new UtilityScanner(new UtilityParser(), logger));
        return scanners;
    }
}
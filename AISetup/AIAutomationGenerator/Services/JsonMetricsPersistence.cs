using System.Text.Json;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public class JsonMetricsPersistence : IAIMetricsPersistence
{
    private readonly string filePath =
        Path.Combine(
            AppContext.BaseDirectory,
            "AI",
            "Metrics.json");

    public IReadOnlyList<AIMetrics> Load()
    {
        if (!File.Exists(filePath))
        {
            return [];
        }

        string json = File.ReadAllText(filePath);

        return JsonSerializer.Deserialize<List<AIMetrics>>(json)
            ?? [];
    }

    public void Save(IReadOnlyList<AIMetrics> metrics)
    {
        Directory.CreateDirectory(
            Path.GetDirectoryName(filePath)!);

        string json =
            JsonSerializer.Serialize(
                metrics,
                new JsonSerializerOptions
                {
                    WriteIndented = true
                });

        File.WriteAllText(
            filePath,
            json);
    }
}

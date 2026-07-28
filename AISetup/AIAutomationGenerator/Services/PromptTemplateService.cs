using AIAutomationGenerator.Interfaces;

namespace AIAutomationGenerator.Services;

public class PromptTemplateService : IPromptTemplateService
{
	private readonly Dictionary<string, string> cache = new(StringComparer.OrdinalIgnoreCase);
	private readonly object cacheLock = new();

	public string Load(string templateName)
	{
		if (string.IsNullOrWhiteSpace(templateName))
		{
			throw new ArgumentException("Template name is required.", nameof(templateName));
		}

		string normalizedName = templateName.EndsWith(".txt", StringComparison.OrdinalIgnoreCase)
			? templateName
			: $"{templateName}.txt";

		lock (cacheLock)
		{
			if (cache.TryGetValue(normalizedName, out string? cachedTemplate))
			{
				return cachedTemplate;
			}
		}

		string[] candidatePaths =
		[
			Path.Combine(AppContext.BaseDirectory, "PromptTemplates", normalizedName),
			Path.Combine(Directory.GetCurrentDirectory(), "PromptTemplates", normalizedName),
			Path.Combine(Directory.GetCurrentDirectory(), "AIAutomationGenerator", "PromptTemplates", normalizedName)
		];

		foreach (string candidatePath in candidatePaths)
		{
			if (File.Exists(candidatePath))
			{
				string template = File.ReadAllText(candidatePath);

				lock (cacheLock)
				{
					cache[normalizedName] = template;
				}

				return template;
			}
		}

		throw new FileNotFoundException($"Prompt template '{normalizedName}' was not found.");
	}

	public string Render(
		string templateName,
		Dictionary<string, string> values)
	{
		string template = Load(templateName);

		foreach ((string key, string value) in values)
		{
			template = template.Replace(
				$"{{{{{key}}}}}",
				value ?? string.Empty,
				StringComparison.Ordinal);
		}

		return template;
	}
}

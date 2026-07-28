using System.Security.Cryptography;
using System.Text;
using AIAutomationGenerator.Interfaces;

namespace AIAutomationGenerator.Services;

public class CacheKeyGenerator : ICacheKeyGenerator
{
    public string Generate(string prompt)
    {
        byte[] bytes = SHA256.HashData(
            Encoding.UTF8.GetBytes(prompt));

        return Convert.ToHexString(bytes);
    }
}

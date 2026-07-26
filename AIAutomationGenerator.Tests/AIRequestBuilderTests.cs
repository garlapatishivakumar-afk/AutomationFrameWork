using System.Collections.Generic;
using AIAutomationGenerator.AI;
using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests;

public class AIRequestBuilderTests
{
    [Fact]
    public void Build_UsesProvidedPromptAndFlows()
    {
        var builder = new AIRequestBuilder();
        var context = new PromptContext();
        var prompt = new PromptModel { Prompt = "Generated prompt" };
        var flows = new List<BusinessFlowModel>
        {
            new()
            {
                Name = "Login",
                Actions = new List<RecordingActionModel>()
            }
        };

        var request = builder.Build(context, prompt, flows);

        Assert.Equal("Generated prompt", request.Prompt);
        Assert.Same(context, request.Context);
        Assert.Same(flows, request.BusinessFlows);
    }

    [Fact]
    public async Task GenerateAsync_ReturnsError_WhenApiKeyMissing()
    {
        var configurationProvider = new TestConfigurationProvider(new AIConfiguration
        {
            Enabled = true,
            ApiKey = string.Empty
        });

        var provider = new OpenAIProvider(
            new TestAIClient(),
            configurationProvider);

        var response = await provider.GenerateAsync(new AIRequest());

        Assert.False(response.Success);
        Assert.Equal("OpenAI API Key not configured.", response.ErrorMessage);
    }

    private sealed class TestConfigurationProvider : IAIConfigurationProvider
    {
        private readonly AIConfiguration configuration;

        public TestConfigurationProvider(AIConfiguration configuration)
        {
            this.configuration = configuration;
        }

        public AIConfiguration GetConfiguration() => configuration;
    }

    private sealed class TestAIClient : IAIClient
    {
        public Task<AIResponse> SendAsync(AIConfiguration configuration, AIRequest request)
        {
            throw new NotSupportedException();
        }
    }
}


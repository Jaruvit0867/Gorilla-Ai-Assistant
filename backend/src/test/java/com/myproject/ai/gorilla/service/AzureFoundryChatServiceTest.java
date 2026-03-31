package com.myproject.ai.gorilla.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AzureFoundryChatServiceTest {

	@Test
	void shouldNormalizeQuotedConfigValues() {
		assertThat(AzureFoundryChatService.normalizeConfigValue(" https://example.com "))
			.isEqualTo("https://example.com");
		assertThat(AzureFoundryChatService.normalizeConfigValue("\"https://example.com/api/projects/demo\""))
			.isEqualTo("https://example.com/api/projects/demo");
		assertThat(AzureFoundryChatService.normalizeConfigValue("'test:2'"))
			.isEqualTo("test:2");
		assertThat(AzureFoundryChatService.normalizeProjectEndpoint("https://example.com/api/projects/demo///"))
			.isEqualTo("https://example.com/api/projects/demo");
		assertThat(AzureFoundryChatService.normalizeConfigValue("   "))
			.isNull();
	}

	@Test
	void shouldParseAgentNameAndVersionFromFoundryEnvValue() {
		AzureFoundryChatService.AgentReferenceParts parts = AzureFoundryChatService.parseAgentReference("\"test:2\"");
		assertThat(parts.name()).isEqualTo("test");
		assertThat(parts.version()).isEqualTo("2");
		assertThat(parts.raw()).isEqualTo("test:2");
	}

}

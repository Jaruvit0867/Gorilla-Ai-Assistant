package com.myproject.ai.gorilla.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

class AzureFoundryChatServiceTest {

	private final ObjectMapper objectMapper = new ObjectMapper();

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

	@Test
	void shouldParseStreamingDeltaEvent() {
		AzureFoundryChatService.FoundrySseEvent event = AzureFoundryChatService.parseFoundrySseEvent(List.of(
				"event: response.output_text.delta",
				"data: {\"type\":\"response.output_text.delta\",\"delta\":\"hello\"}"));

		assertThat(event.event()).isEqualTo("response.output_text.delta");
		assertThat(AzureFoundryChatService.extractStreamDelta(event.event(), event.data(), this.objectMapper))
			.isEqualTo("hello");
	}

	@Test
	void shouldIgnoreDoneMalformedAndEmptyStreamingEvents() {
		assertThat(AzureFoundryChatService.extractStreamDelta(null, "[DONE]", this.objectMapper)).isNull();
		assertThat(AzureFoundryChatService.extractStreamDelta(
				"response.output_text.delta",
				"{not-json}",
				this.objectMapper)).isNull();
		assertThat(AzureFoundryChatService.extractStreamDelta(
				"response.output_text.delta",
				"{\"type\":\"response.output_text.delta\",\"delta\":\"\"}",
				this.objectMapper)).isNull();
	}

}

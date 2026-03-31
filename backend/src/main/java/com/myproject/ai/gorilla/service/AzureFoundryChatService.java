package com.myproject.ai.gorilla.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpSession;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import com.azure.core.credential.AccessToken;
import com.azure.core.credential.TokenCredential;
import com.azure.core.credential.TokenRequestContext;
import com.azure.identity.DefaultAzureCredentialBuilder;

import com.myproject.ai.gorilla.config.AzureFoundryProperties;
import com.myproject.ai.gorilla.dto.ChatHistoryResponse;
import com.myproject.ai.gorilla.dto.ChatMessage;
import com.myproject.ai.gorilla.dto.ChatRequest;
import com.myproject.ai.gorilla.dto.ChatResponse;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class AzureFoundryChatService {

	private static final String AI_FOUNDRY_SCOPE = "https://ai.azure.com/.default";

	private static final String CHAT_HISTORY_SESSION_ATTRIBUTE = "CHAT_HISTORY";

	private final AzureFoundryProperties properties;

	private final TokenCredential tokenCredential;

	public AzureFoundryChatService(AzureFoundryProperties properties) {
		this.properties = properties;
		this.tokenCredential = new DefaultAzureCredentialBuilder().build();
	}

	public ChatResponse generateAnswer(ChatRequest request, HttpSession session) {
		String prompt = normalizeText(request.prompt(), "prompt");
		String projectEndpoint = normalizeProjectEndpoint(normalizeConfiguredValue(
				this.properties.getProjectEndpoint(),
				"AZURE_EXISTING_AIPROJECT_ENDPOINT"));
		AgentReferenceParts agentReference = parseAgentReference(normalizeConfiguredValue(
				this.properties.getAgentId(),
				"AZURE_EXISTING_AGENT_ID"));
		List<ChatMessage> history = getMutableHistory(session);
		ChatMessage userMessage = ChatMessage.user(prompt, Instant.now());
		Map<String, Object> responseRequest = buildResponseRequest(request, agentReference, history, userMessage);

		try {
			AgentResponseEnvelope response = RestClient.builder()
				.baseUrl(projectEndpoint)
				.defaultHeader(AUTHORIZATION, "Bearer " + acquireAccessToken())
				.build()
				.post()
				.uri("/openai/v1/responses")
				.contentType(APPLICATION_JSON)
				.body(responseRequest)
				.retrieve()
				.body(AgentResponseEnvelope.class);

			if (response == null) {
				throw new ResponseStatusException(BAD_GATEWAY,
						"Azure AI Foundry agent returned an empty response.");
			}

			String answer = extractAnswer(response);
			Instant createdAt = firstNonNull(toInstant(response.created_at()), Instant.now());
			ChatMessage assistantMessage = ChatMessage.assistant(answer, createdAt);
			List<ChatMessage> updatedHistory = new ArrayList<>(history);
			updatedHistory.add(userMessage);
			updatedHistory.add(assistantMessage);
			storeHistory(session, updatedHistory);

			return new ChatResponse(
					answer,
					firstNonBlank(trimToNull(response.model()), agentReference.raw()),
					trimToNull(response.id()),
					createdAt,
					session.getId(),
					List.copyOf(updatedHistory),
					agentReference.raw(),
					agentReference.name());
		}
		catch (ResponseStatusException exception) {
			throw exception;
		}
		catch (RestClientResponseException exception) {
			String details = trimToNull(exception.getResponseBodyAsString());
			String message = "Azure AI Foundry agent request failed: HTTP "
					+ exception.getStatusCode().value()
					+ (details != null ? ", " + details : "");
			throw new ResponseStatusException(BAD_GATEWAY, message, exception);
		}
		catch (RestClientException exception) {
			throw new ResponseStatusException(BAD_GATEWAY,
					"Azure AI Foundry agent request failed: " + exception.getMessage(), exception);
		}
		catch (RuntimeException exception) {
			throw new ResponseStatusException(BAD_GATEWAY,
					"Azure AI Foundry agent request failed: " + exception.getMessage(), exception);
		}
	}

	public ChatHistoryResponse getHistory(HttpSession session) {
		return new ChatHistoryResponse(session.getId(), snapshotHistory(session));
	}

	public ChatHistoryResponse clearHistory(HttpSession session) {
		session.removeAttribute(CHAT_HISTORY_SESSION_ATTRIBUTE);
		return new ChatHistoryResponse(session.getId(), List.of());
	}

	static String normalizeConfigValue(String value) {
		String normalized = trimToNull(value);
		if (normalized == null) {
			return null;
		}

		while (normalized.length() >= 2) {
			boolean wrappedInDoubleQuotes = normalized.startsWith("\"") && normalized.endsWith("\"");
			boolean wrappedInSingleQuotes = normalized.startsWith("'") && normalized.endsWith("'");
			if (!wrappedInDoubleQuotes && !wrappedInSingleQuotes) {
				break;
			}
			normalized = trimToNull(normalized.substring(1, normalized.length() - 1));
			if (normalized == null) {
				return null;
			}
		}

		return normalized;
	}

	static AgentReferenceParts parseAgentReference(String configuredAgentId) {
		String normalized = normalizeConfigValue(configuredAgentId);
		if (normalized == null) {
			throw new ResponseStatusException(SERVICE_UNAVAILABLE,
					"Missing Azure AI Foundry configuration. Please set AZURE_EXISTING_AGENT_ID.");
		}

		int separatorIndex = normalized.lastIndexOf(':');
		if (separatorIndex < 0) {
			return new AgentReferenceParts(normalized, null, normalized);
		}

		String name = trimToNull(normalized.substring(0, separatorIndex));
		String version = trimToNull(normalized.substring(separatorIndex + 1));
		if (name == null || version == null) {
			throw new ResponseStatusException(SERVICE_UNAVAILABLE,
					"Invalid AZURE_EXISTING_AGENT_ID format. Expected <agent-name> or <agent-name>:<version>.");
		}

		return new AgentReferenceParts(name, version, normalized);
	}

	private Map<String, Object> buildResponseRequest(
			ChatRequest request,
			AgentReferenceParts agentReference,
			List<ChatMessage> history,
			ChatMessage userMessage) {
		String instructions = firstNonBlank(
				normalizeConfigValue(request.systemPrompt()),
				normalizeConfigValue(this.properties.getAdditionalInstructions()));
		Double temperature = request.temperature() != null ? request.temperature() : this.properties.getTemperature();
		Integer maxOutputTokens = request.maxOutputTokens() != null
				? request.maxOutputTokens()
				: this.properties.getMaxCompletionTokens();

		Map<String, Object> requestBody = new LinkedHashMap<>();
		requestBody.put("agent_reference", agentReference.toRequestMap());
		requestBody.put("input", buildInputMessages(history, userMessage));
		if (instructions != null) {
			requestBody.put("instructions", instructions);
		}
		if (temperature != null) {
			requestBody.put("temperature", temperature);
		}
		if (maxOutputTokens != null) {
			requestBody.put("max_output_tokens", maxOutputTokens);
		}
		return requestBody;
	}

	private List<Map<String, String>> buildInputMessages(List<ChatMessage> history, ChatMessage userMessage) {
		List<Map<String, String>> input = new ArrayList<>();
		for (ChatMessage message : history) {
			String role = normalizeHistoryRole(message.role());
			String content = trimToNull(message.content());
			if (role == null || content == null) {
				continue;
			}
			input.add(Map.of("role", role, "content", content));
		}
		input.add(Map.of("role", userMessage.role(), "content", userMessage.content()));
		return input;
	}

	private String acquireAccessToken() {
		AccessToken accessToken = this.tokenCredential.getTokenSync(
				new TokenRequestContext().addScopes(AI_FOUNDRY_SCOPE));
		String token = accessToken != null ? trimToNull(accessToken.getToken()) : null;
		if (token == null) {
			throw new ResponseStatusException(BAD_GATEWAY,
					"Azure AI Foundry authentication did not return an access token.");
		}
		return token;
	}

	private String extractAnswer(AgentResponseEnvelope response) {
		String outputText = trimToNull(response.output_text());
		if (outputText != null) {
			return outputText;
		}

		if (response.output() != null) {
			for (OutputItem item : response.output()) {
				if (item == null || item.content() == null) {
					continue;
				}
				StringBuilder builder = new StringBuilder();
				for (OutputContent content : item.content()) {
					String text = content != null ? trimToNull(content.text()) : null;
					if (text == null) {
						continue;
					}
					if (builder.length() > 0) {
						builder.append('\n');
					}
					builder.append(text);
				}
				String candidate = trimToNull(builder.toString());
				if (candidate != null) {
					return candidate;
				}
			}
		}

		throw new ResponseStatusException(BAD_GATEWAY,
				"Azure AI Foundry agent returned no text answer.");
	}

	private void storeHistory(HttpSession session, List<ChatMessage> history) {
		session.setAttribute(CHAT_HISTORY_SESSION_ATTRIBUTE, new ArrayList<>(history));
	}

	private List<ChatMessage> snapshotHistory(HttpSession session) {
		return List.copyOf(getMutableHistory(session));
	}

	private List<ChatMessage> getMutableHistory(HttpSession session) {
		Object attribute = session.getAttribute(CHAT_HISTORY_SESSION_ATTRIBUTE);
		if (!(attribute instanceof List<?> rawHistory)) {
			return new ArrayList<>();
		}

		List<ChatMessage> history = new ArrayList<>();
		for (Object item : rawHistory) {
			if (item instanceof ChatMessage message) {
				String role = normalizeHistoryRole(message.role());
				String content = trimToNull(message.content());
				if (role != null && content != null) {
					history.add(new ChatMessage(role, content, message.createdAt()));
				}
			}
		}
		return history;
	}

	static String normalizeProjectEndpoint(String value) {
		String normalized = normalizeConfigValue(value);
		if (normalized == null) {
			return null;
		}
		while (normalized.endsWith("/")) {
			normalized = normalized.substring(0, normalized.length() - 1);
		}
		return normalized;
	}

	private static Instant toInstant(Long createdAtEpochSeconds) {
		if (createdAtEpochSeconds == null) {
			return null;
		}
		return Instant.EPOCH.plus(createdAtEpochSeconds, ChronoUnit.SECONDS);
	}

	private static <T> T firstNonNull(T primary, T fallback) {
		return primary != null ? primary : fallback;
	}

	private static String firstNonBlank(String primary, String fallback) {
		return primary != null ? primary : fallback;
	}

	private static String normalizeHistoryRole(String role) {
		String normalized = trimToNull(role);
		if ("agent".equals(normalized)) {
			return "assistant";
		}
		if ("assistant".equals(normalized) || "user".equals(normalized)) {
			return normalized;
		}
		return null;
	}

	private static String normalizeConfiguredValue(String value, String envName) {
		String normalized = normalizeConfigValue(value);
		if (normalized == null) {
			throw new ResponseStatusException(SERVICE_UNAVAILABLE,
					"Missing Azure AI Foundry configuration. Please set " + envName + ".");
		}
		return normalized;
	}

	private static String normalizeText(String value, String fieldName) {
		String normalized = trimToNull(value);
		if (normalized == null) {
			throw new ResponseStatusException(BAD_REQUEST,
					"The request field '" + fieldName + "' must not be blank.");
		}
		return normalized;
	}

	private static String trimToNull(String value) {
		if (value == null) {
			return null;
		}

		String trimmed = value.trim();
		if (trimmed.isEmpty()) {
			return null;
		}
		return trimmed;
	}

	record AgentReferenceParts(String name, String version, String raw) {

		Map<String, Object> toRequestMap() {
			Map<String, Object> agentReference = new LinkedHashMap<>();
			agentReference.put("type", "agent_reference");
			agentReference.put("name", this.name);
			if (this.version != null) {
				agentReference.put("version", this.version);
			}
			return agentReference;
		}
	}

	private record AgentResponseEnvelope(
			String id,
			String model,
			Long created_at,
			String conversation,
			String output_text,
			List<OutputItem> output) {
	}

	private record OutputItem(String role, List<OutputContent> content) {
	}

	private record OutputContent(String text) {
	}
}

package com.myproject.ai.gorilla.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;

import jakarta.servlet.http.HttpSession;

import org.springframework.stereotype.Service;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.azure.core.credential.AccessToken;
import com.azure.core.credential.TokenCredential;
import com.azure.core.credential.TokenRequestContext;
import com.azure.identity.DefaultAzureCredentialBuilder;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.myproject.ai.gorilla.config.AzureFoundryProperties;
import com.myproject.ai.gorilla.dto.ChatHistoryResponse;
import com.myproject.ai.gorilla.dto.ChatMessage;
import com.myproject.ai.gorilla.dto.ChatRequest;
import com.myproject.ai.gorilla.dto.ChatResponse;
import com.myproject.ai.gorilla.dto.ChatStreamDelta;
import com.myproject.ai.gorilla.dto.ChatStreamError;
import com.myproject.ai.gorilla.dto.ChatStreamMeta;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.GATEWAY_TIMEOUT;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class AzureFoundryChatService {

	private static final String AI_FOUNDRY_SCOPE = "https://ai.azure.com/.default";

	private static final String CHAT_HISTORY_SESSION_ATTRIBUTE = "CHAT_HISTORY";

	private final AzureFoundryProperties properties;

	private final ObjectMapper objectMapper;

	private final TokenCredential tokenCredential;

	public AzureFoundryChatService(AzureFoundryProperties properties) {
		this.properties = properties;
		this.objectMapper = new ObjectMapper();
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
				.requestFactory(createRequestFactory())
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
			String message = buildFoundryResponseErrorMessage(exception.getStatusCode().value(), details);
			throw new ResponseStatusException(BAD_GATEWAY, message, exception);
		}
		catch (ResourceAccessException exception) {
			throw new ResponseStatusException(GATEWAY_TIMEOUT,
					"Azure AI Foundry agent request timed out after "
							+ normalizeTimeout(this.properties.getResponseTimeout(), Duration.ofSeconds(60)).toSeconds()
							+ " seconds. Menu/RAG answers can take longer than simple greetings.",
					exception);
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

	public SseEmitter streamAnswer(ChatRequest request, HttpSession session) {
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
		responseRequest.put("stream", true);

		Duration responseTimeout = normalizeTimeout(this.properties.getResponseTimeout(), Duration.ofSeconds(60));
		SseEmitter emitter = new SseEmitter(responseTimeout.plusSeconds(10).toMillis());
		CompletableFuture.runAsync(() -> streamAnswerToEmitter(
				emitter,
				projectEndpoint,
				agentReference,
				session,
				history,
				userMessage,
				responseRequest));
		return emitter;
	}

	private void streamAnswerToEmitter(
			SseEmitter emitter,
			String projectEndpoint,
			AgentReferenceParts agentReference,
			HttpSession session,
			List<ChatMessage> history,
			ChatMessage userMessage,
			Map<String, Object> responseRequest) {
		StringBuilder answerBuilder = new StringBuilder();
		StreamMetadata streamMetadata = new StreamMetadata(null, null, null);

		try {
			sendStreamEvent(emitter, "meta", new ChatStreamMeta(session.getId(), agentReference.raw(), agentReference.name()));

			HttpResponse<Stream<String>> response = createStreamingHttpClient().send(
					buildStreamingRequest(projectEndpoint, responseRequest),
					HttpResponse.BodyHandlers.ofLines());

			if (response.statusCode() < 200 || response.statusCode() >= 300) {
				String details;
				try (Stream<String> body = response.body()) {
					details = trimToNull(String.join("\n", body.limit(20).toList()));
				}
				throw new ResponseStatusException(BAD_GATEWAY,
						buildFoundryResponseErrorMessage(response.statusCode(), details));
			}

			List<String> eventLines = new ArrayList<>();
			try (Stream<String> lines = response.body()) {
				Iterator<String> iterator = lines.iterator();
				while (iterator.hasNext()) {
					String line = iterator.next();
					if (line.isBlank()) {
						StreamMetadata eventMetadata = processStreamEvent(
								emitter,
								eventLines,
								answerBuilder,
								streamMetadata);
						streamMetadata = eventMetadata != null ? eventMetadata : streamMetadata;
						eventLines.clear();
						continue;
					}
					eventLines.add(line);
				}
			}

			if (!eventLines.isEmpty()) {
				StreamMetadata eventMetadata = processStreamEvent(emitter, eventLines, answerBuilder, streamMetadata);
				streamMetadata = eventMetadata != null ? eventMetadata : streamMetadata;
			}

			String answer = trimToNull(answerBuilder.toString());
			if (answer == null) {
				throw new ResponseStatusException(BAD_GATEWAY,
						"Azure AI Foundry agent returned no streamed text answer.");
			}

			Instant createdAt = firstNonNull(streamMetadata.createdAt(), Instant.now());
			ChatMessage assistantMessage = ChatMessage.assistant(answer, createdAt);
			List<ChatMessage> updatedHistory = new ArrayList<>(history);
			updatedHistory.add(userMessage);
			updatedHistory.add(assistantMessage);
			storeHistory(session, updatedHistory);

			sendStreamEvent(emitter, "done", new ChatResponse(
					answer,
					firstNonBlank(trimToNull(streamMetadata.model()), agentReference.raw()),
					trimToNull(streamMetadata.responseId()),
					createdAt,
					session.getId(),
					List.copyOf(updatedHistory),
					agentReference.raw(),
					agentReference.name()));
			emitter.complete();
		}
		catch (ResponseStatusException exception) {
			sendStreamError(emitter, exception.getReason());
		}
		catch (IOException exception) {
			sendStreamError(emitter, "Azure AI Foundry streaming request failed: " + exception.getMessage());
		}
		catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			sendStreamError(emitter, "Azure AI Foundry streaming request was interrupted.");
		}
		catch (RuntimeException exception) {
			sendStreamError(emitter, "Azure AI Foundry streaming request failed: " + exception.getMessage());
		}
	}

	private HttpRequest buildStreamingRequest(String projectEndpoint, Map<String, Object> responseRequest)
			throws JsonProcessingException {
		String requestBody = this.objectMapper.writeValueAsString(responseRequest);
		return HttpRequest.newBuilder(URI.create(projectEndpoint + "/openai/v1/responses"))
			.timeout(normalizeTimeout(this.properties.getResponseTimeout(), Duration.ofSeconds(60)))
			.header(AUTHORIZATION, "Bearer " + acquireAccessToken())
			.header("Accept", MediaType.TEXT_EVENT_STREAM_VALUE)
			.header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
			.POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
			.build();
	}

	private HttpClient createStreamingHttpClient() {
		return HttpClient.newBuilder()
			.connectTimeout(normalizeTimeout(this.properties.getConnectTimeout(), Duration.ofSeconds(10)))
			.build();
	}

	private StreamMetadata processStreamEvent(
			SseEmitter emitter,
			List<String> eventLines,
			StringBuilder answerBuilder,
			StreamMetadata currentMetadata) throws IOException {
		FoundrySseEvent event = parseFoundrySseEvent(eventLines);
		if (event == null || "[DONE]".equals(event.data())) {
			return currentMetadata;
		}

		String delta = extractStreamDelta(event.event(), event.data(), this.objectMapper);
		if (delta != null) {
			answerBuilder.append(delta);
			sendStreamEvent(emitter, "delta", new ChatStreamDelta(delta));
		}

		StreamMetadata metadata = extractStreamMetadata(event.event(), event.data(), this.objectMapper);
		return metadata != null ? currentMetadata.merge(metadata) : currentMetadata;
	}

	private void sendStreamEvent(SseEmitter emitter, String eventName, Object data) throws IOException {
		emitter.send(SseEmitter.event().name(eventName).data(data, MediaType.APPLICATION_JSON));
	}

	private void sendStreamError(SseEmitter emitter, String message) {
		try {
			sendStreamEvent(emitter, "error", new ChatStreamError(firstNonBlank(trimToNull(message), "Streaming request failed.")));
			emitter.complete();
		}
		catch (IOException sendException) {
			emitter.completeWithError(sendException);
		}
	}

	private JdkClientHttpRequestFactory createRequestFactory() {
		Duration connectTimeout = normalizeTimeout(this.properties.getConnectTimeout(), Duration.ofSeconds(10));
		Duration responseTimeout = normalizeTimeout(this.properties.getResponseTimeout(), Duration.ofSeconds(60));
		HttpClient httpClient = HttpClient.newBuilder()
			.connectTimeout(connectTimeout)
			.build();
		JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
		requestFactory.setReadTimeout(responseTimeout);
		return requestFactory;
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

	private static String buildFoundryResponseErrorMessage(int statusCode, String details) {
		String message = "Azure AI Foundry agent request failed: HTTP " + statusCode;
		if (details != null) {
			message += ", " + details;
		}
		return message;
	}

	static FoundrySseEvent parseFoundrySseEvent(List<String> lines) {
		String eventName = null;
		StringBuilder dataBuilder = new StringBuilder();

		for (String rawLine : lines) {
			if (rawLine == null || rawLine.isBlank() || rawLine.startsWith(":")) {
				continue;
			}

			int separatorIndex = rawLine.indexOf(':');
			String field = separatorIndex >= 0 ? rawLine.substring(0, separatorIndex) : rawLine;
			String value = separatorIndex >= 0 ? rawLine.substring(separatorIndex + 1) : "";
			if (value.startsWith(" ")) {
				value = value.substring(1);
			}

			if ("event".equals(field)) {
				eventName = trimToNull(value);
			}
			else if ("data".equals(field)) {
				if (dataBuilder.length() > 0) {
					dataBuilder.append('\n');
				}
				dataBuilder.append(value);
			}
		}

		String data = dataBuilder.length() > 0 ? dataBuilder.toString() : null;
		if (eventName == null && data == null) {
			return null;
		}
		return new FoundrySseEvent(eventName, data);
	}

	static String extractStreamDelta(String eventName, String data, ObjectMapper objectMapper) {
		if (data == null || "[DONE]".equals(data)) {
			return null;
		}

		try {
			JsonNode root = objectMapper.readTree(data);
			String type = firstJsonText(root, "type");
			if (!"response.output_text.delta".equals(eventName)
					&& !"response.output_text.delta".equals(type)) {
				return null;
			}

			String delta = firstJsonText(root, "delta", "text");
			return delta != null && !delta.isEmpty() ? delta : null;
		}
		catch (JsonProcessingException exception) {
			return null;
		}
	}

	private static StreamMetadata extractStreamMetadata(String eventName, String data, ObjectMapper objectMapper) {
		if (data == null || "[DONE]".equals(data)) {
			return null;
		}

		try {
			JsonNode root = objectMapper.readTree(data);
			String type = firstJsonText(root, "type");
			if (!"response.completed".equals(eventName) && !"response.completed".equals(type)) {
				return null;
			}

			JsonNode response = root.has("response") ? root.get("response") : root;
			String responseId = firstJsonText(response, "id");
			String model = firstJsonText(response, "model");
			Instant createdAt = jsonEpochSecondsToInstant(response.get("created_at"));
			return new StreamMetadata(responseId, model, createdAt);
		}
		catch (JsonProcessingException exception) {
			return null;
		}
	}

	private static String firstJsonText(JsonNode node, String... fieldNames) {
		if (node == null || node.isMissingNode() || node.isNull()) {
			return null;
		}
		for (String fieldName : fieldNames) {
			JsonNode value = node.get(fieldName);
			if (value != null && !value.isNull()) {
				return value.asText();
			}
		}
		return null;
	}

	private static Instant jsonEpochSecondsToInstant(JsonNode node) {
		if (node == null || !node.canConvertToLong()) {
			return null;
		}
		return toInstant(node.asLong());
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

	private static Duration normalizeTimeout(Duration value, Duration fallback) {
		if (value == null || value.isZero() || value.isNegative()) {
			return fallback;
		}
		return value;
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

	record FoundrySseEvent(String event, String data) {
	}

	private record StreamMetadata(String responseId, String model, Instant createdAt) {

		StreamMetadata merge(StreamMetadata next) {
			return new StreamMetadata(
					firstNonBlank(trimToNull(next.responseId()), trimToNull(this.responseId)),
					firstNonBlank(trimToNull(next.model()), trimToNull(this.model)),
					firstNonNull(next.createdAt(), this.createdAt));
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

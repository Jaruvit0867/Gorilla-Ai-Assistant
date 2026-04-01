package com.myproject.ai.gorilla.service;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import com.myproject.ai.gorilla.config.AzureSpeechProperties;

import static org.springframework.http.HttpHeaders.USER_AGENT;
import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class AzureSpeechTtsService {

	private static final MediaType SSML_MEDIA_TYPE = MediaType.parseMediaType("application/ssml+xml; charset=UTF-8");

	private static final String OUTPUT_FORMAT_HEADER = "X-Microsoft-OutputFormat";

	private static final String SUBSCRIPTION_KEY_HEADER = "Ocp-Apim-Subscription-Key";

	private static final String DEFAULT_USER_AGENT = "gorilla-backend";

	private final AzureSpeechProperties properties;

	public AzureSpeechTtsService(AzureSpeechProperties properties) {
		this.properties = properties;
	}

	public byte[] synthesize(String text) {
		String normalizedText = normalizeRequiredText(text, "text");
		String subscriptionKey = normalizeConfiguredValue(this.properties.getKey(), "AZURE_SPEECH_KEY");
		String voiceName = normalizeConfiguredValue(this.properties.getVoiceName(), "AZURE_SPEECH_VOICE_NAME");
		String outputFormat = normalizeConfiguredValue(this.properties.getOutputFormat(), "AZURE_SPEECH_OUTPUT_FORMAT");
		String synthesisUrl = resolveSynthesisUrl(this.properties.getEndpoint(), this.properties.getRegion());
		String ssml = buildSsml(normalizedText, voiceName, resolveVoiceLocale(voiceName));

		try {
			byte[] audio = RestClient.builder()
				.build()
				.post()
				.uri(synthesisUrl)
				.header(SUBSCRIPTION_KEY_HEADER, subscriptionKey)
				.header(OUTPUT_FORMAT_HEADER, outputFormat)
				.header(USER_AGENT, DEFAULT_USER_AGENT)
				.contentType(SSML_MEDIA_TYPE)
				.body(ssml)
				.retrieve()
				.body(byte[].class);

			if (audio == null || audio.length == 0) {
				throw new ResponseStatusException(BAD_GATEWAY, "Azure Speech returned empty audio.");
			}

			return audio;
		}
		catch (ResponseStatusException exception) {
			throw exception;
		}
		catch (RestClientResponseException exception) {
			String details = trimToNull(exception.getResponseBodyAsString());
			String message = "Azure Speech TTS request failed: HTTP "
					+ exception.getStatusCode().value()
					+ (details != null ? ", " + details : "");
			throw new ResponseStatusException(BAD_GATEWAY, message, exception);
		}
		catch (RestClientException exception) {
			throw new ResponseStatusException(BAD_GATEWAY,
					"Azure Speech TTS request failed: " + exception.getMessage(), exception);
		}
		catch (RuntimeException exception) {
			throw new ResponseStatusException(BAD_GATEWAY,
					"Azure Speech TTS request failed: " + exception.getMessage(), exception);
		}
	}

	static String resolveSynthesisUrl(String endpoint, String region) {
		String normalizedRegion = normalizeConfigValue(region);
		String normalizedEndpoint = normalizeConfigValue(endpoint);

		if (normalizedEndpoint != null && normalizedEndpoint.contains(".tts.speech.")) {
			return appendSynthesisPath(normalizedEndpoint);
		}

		if (normalizedRegion != null) {
			return "https://" + normalizedRegion + ".tts.speech.microsoft.com/cognitiveservices/v1";
		}

		if (normalizedEndpoint != null) {
			return appendSynthesisPath(normalizedEndpoint);
		}

		throw new ResponseStatusException(SERVICE_UNAVAILABLE,
				"Missing Azure Speech configuration. Please set AZURE_LOCATION or AZURE_SPEECH_ENDPOINT.");
	}

	static String resolveVoiceLocale(String voiceName) {
		String normalizedVoiceName = normalizeConfigValue(voiceName);
		if (normalizedVoiceName == null) {
			return "th-TH";
		}

		String[] parts = normalizedVoiceName.split("-");
		if (parts.length >= 2) {
			return parts[0] + "-" + parts[1];
		}
		return "th-TH";
	}

	static String buildSsml(String text, String voiceName, String locale) {
		return """
				<speak version="1.0" xml:lang="%s" xmlns="http://www.w3.org/2001/10/synthesis">
				  <voice name="%s">
				    %s
				  </voice>
				</speak>
				""".formatted(escapeXml(locale), escapeXml(voiceName), escapeXml(text));
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

	private static String appendSynthesisPath(String endpoint) {
		String normalized = endpoint;
		while (normalized.endsWith("/")) {
			normalized = normalized.substring(0, normalized.length() - 1);
		}
		if (normalized.endsWith("/cognitiveservices/v1")) {
			return normalized;
		}
		return normalized + "/cognitiveservices/v1";
	}

	private static String normalizeConfiguredValue(String value, String envName) {
		String normalized = normalizeConfigValue(value);
		if (normalized == null) {
			throw new ResponseStatusException(SERVICE_UNAVAILABLE,
					"Missing Azure Speech configuration. Please set " + envName + ".");
		}
		return normalized;
	}

	private static String normalizeRequiredText(String value, String fieldName) {
		String normalized = trimToNull(value);
		if (normalized == null) {
			throw new ResponseStatusException(BAD_REQUEST,
					"The request field '" + fieldName + "' must not be blank.");
		}
		return normalized;
	}

	private static String escapeXml(String value) {
		return value
			.replace("&", "&amp;")
			.replace("<", "&lt;")
			.replace(">", "&gt;")
			.replace("\"", "&quot;")
			.replace("'", "&apos;");
	}

	private static String trimToNull(String value) {
		if (value == null) {
			return null;
		}

		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

}

package com.myproject.ai.gorilla.dto;

import java.time.Instant;
import java.util.List;

public record ChatResponse(
		String answer,
		String model,
		String responseId,
		Instant createdAt,
		String sessionId,
		List<ChatMessage> history,
		String agentId,
		String agentName) {
}

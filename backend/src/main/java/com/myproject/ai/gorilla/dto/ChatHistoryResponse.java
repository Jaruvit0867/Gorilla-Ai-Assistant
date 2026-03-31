package com.myproject.ai.gorilla.dto;

import java.util.List;

public record ChatHistoryResponse(String sessionId, List<ChatMessage> messages) {
}

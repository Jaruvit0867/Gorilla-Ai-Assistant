package com.myproject.ai.gorilla.dto;

import java.io.Serializable;
import java.time.Instant;

public record ChatMessage(String role, String content, Instant createdAt) implements Serializable {

	public static ChatMessage user(String content, Instant createdAt) {
		return new ChatMessage("user", content, createdAt);
	}

	public static ChatMessage assistant(String content, Instant createdAt) {
		return new ChatMessage("assistant", content, createdAt);
	}

}

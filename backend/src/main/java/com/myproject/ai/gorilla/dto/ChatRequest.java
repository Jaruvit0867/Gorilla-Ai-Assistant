package com.myproject.ai.gorilla.dto;

public record ChatRequest(
		String prompt,
		String systemPrompt,
		Double temperature,
		Integer maxOutputTokens) {
}

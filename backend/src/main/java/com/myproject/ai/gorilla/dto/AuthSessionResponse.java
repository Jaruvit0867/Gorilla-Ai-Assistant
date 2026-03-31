package com.myproject.ai.gorilla.dto;

public record AuthSessionResponse(
		boolean authenticated,
		String username,
		String role,
		String sessionId) {

	public static AuthSessionResponse unauthenticated(String sessionId) {
		return new AuthSessionResponse(false, null, null, sessionId);
	}

}

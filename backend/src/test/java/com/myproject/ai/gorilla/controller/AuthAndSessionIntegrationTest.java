package com.myproject.ai.gorilla.controller;

import jakarta.servlet.http.HttpSession;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthAndSessionIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void shouldReturnUnauthenticatedStatusWhenNoSessionExists() throws Exception {
		this.mockMvc.perform(get("/api/auth/me"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.authenticated").value(false));
	}

	@Test
	void shouldRejectProtectedChatEndpointsWithoutAuthentication() throws Exception {
		this.mockMvc.perform(post("/api/ai/chat")
				.contentType(APPLICATION_JSON)
				.content("""
						{
						  "prompt": "hello"
						}
						"""))
			.andExpect(status().isUnauthorized());

		this.mockMvc.perform(post("/api/speech/tts")
				.contentType(APPLICATION_JSON)
				.content("""
						{
						  "text": "hello"
						}
						"""))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void shouldCreateAdminSessionAndAllowHistoryEndpoints() throws Exception {
		MockHttpSession session = new MockHttpSession();

		this.mockMvc.perform(post("/api/auth/login")
				.session(session)
				.contentType(APPLICATION_JSON)
				.content("""
						{
						  "username": "test-admin",
						  "password": "test-password"
						}
						"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.authenticated").value(true))
			.andExpect(jsonPath("$.role").value("ADMIN"));

		this.mockMvc.perform(get("/api/auth/me").session(session))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.authenticated").value(true))
			.andExpect(jsonPath("$.username").value("test-admin"));

		this.mockMvc.perform(get("/api/ai/history").session(session))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.messages").isArray())
			.andExpect(jsonPath("$.messages.length()").value(0));

		this.mockMvc.perform(delete("/api/ai/history").session(session))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.messages.length()").value(0));
	}

}

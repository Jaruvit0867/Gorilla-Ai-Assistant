package com.myproject.ai.gorilla.controller;

import jakarta.servlet.http.HttpSession;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.myproject.ai.gorilla.dto.ChatHistoryResponse;
import com.myproject.ai.gorilla.dto.ChatRequest;
import com.myproject.ai.gorilla.dto.ChatResponse;
import com.myproject.ai.gorilla.service.AzureFoundryChatService;

@RestController
@RequestMapping("/api/ai")
public class AiChatController {

	private final AzureFoundryChatService azureFoundryChatService;

	public AiChatController(AzureFoundryChatService azureFoundryChatService) {
		this.azureFoundryChatService = azureFoundryChatService;
	}

	@PostMapping("/chat")
	@ResponseStatus(HttpStatus.OK)
	public ChatResponse chat(@RequestBody ChatRequest request, HttpSession session) {
		return this.azureFoundryChatService.generateAnswer(request, session);
	}

	@GetMapping("/history")
	@ResponseStatus(HttpStatus.OK)
	public ChatHistoryResponse history(HttpSession session) {
		return this.azureFoundryChatService.getHistory(session);
	}

	@DeleteMapping("/history")
	@ResponseStatus(HttpStatus.OK)
	public ChatHistoryResponse clearHistory(HttpSession session) {
		return this.azureFoundryChatService.clearHistory(session);
	}

}

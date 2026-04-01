package com.myproject.ai.gorilla.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.myproject.ai.gorilla.dto.TtsRequest;
import com.myproject.ai.gorilla.service.AzureSpeechTtsService;

@RestController
@RequestMapping("/api/speech")
public class SpeechController {

	private static final MediaType AUDIO_MPEG = MediaType.parseMediaType("audio/mpeg");

	private final AzureSpeechTtsService azureSpeechTtsService;

	public SpeechController(AzureSpeechTtsService azureSpeechTtsService) {
		this.azureSpeechTtsService = azureSpeechTtsService;
	}

	@PostMapping(value = "/tts", produces = "audio/mpeg")
	public ResponseEntity<byte[]> synthesize(@RequestBody TtsRequest request) {
		byte[] audio = this.azureSpeechTtsService.synthesize(request.text());
		return ResponseEntity.ok()
			.contentType(AUDIO_MPEG)
			.cacheControl(CacheControl.noStore())
			.body(audio);
	}

}

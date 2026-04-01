package com.myproject.ai.gorilla.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AzureSpeechTtsServiceTest {

	@Test
	void shouldResolveRegionEndpointForSynthesis() {
		String url = AzureSpeechTtsService.resolveSynthesisUrl(
				"https://example.cognitiveservices.azure.com/",
				"eastus2");

		assertEquals("https://eastus2.tts.speech.microsoft.com/cognitiveservices/v1", url);
	}

	@Test
	void shouldBuildEscapedSsml() {
		String ssml = AzureSpeechTtsService.buildSsml(
				"ราคา < 120 & พร้อมเสิร์ฟ",
				"th-TH-PremwadeeNeural",
				"th-TH");

		assertTrue(ssml.contains("&lt; 120 &amp; พร้อมเสิร์ฟ"));
		assertTrue(ssml.contains("th-TH-PremwadeeNeural"));
	}

}

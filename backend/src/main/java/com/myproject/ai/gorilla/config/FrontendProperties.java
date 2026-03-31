package com.myproject.ai.gorilla.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.frontend")
public class FrontendProperties {

	private String origin = "http://localhost:3000";

	public String getOrigin() {
		return this.origin;
	}

	public void setOrigin(String origin) {
		this.origin = origin;
	}

}

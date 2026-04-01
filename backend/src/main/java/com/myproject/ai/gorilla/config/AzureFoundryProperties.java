package com.myproject.ai.gorilla.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "azure.ai.foundry")
public class AzureFoundryProperties {

	private String projectEndpoint;

	private String agentId;

	private String additionalInstructions;

	private Double temperature;

	private Integer maxCompletionTokens;

	public String getProjectEndpoint() {
		return this.projectEndpoint;
	}

	public void setProjectEndpoint(String projectEndpoint) {
		this.projectEndpoint = projectEndpoint;
	}

	public String getAgentId() {
		return this.agentId;
	}

	public void setAgentId(String agentId) {
		this.agentId = agentId;
	}

	public String getAdditionalInstructions() {
		return this.additionalInstructions;
	}

	public void setAdditionalInstructions(String additionalInstructions) {
		this.additionalInstructions = additionalInstructions;
	}

	public Double getTemperature() {
		return this.temperature;
	}

	public void setTemperature(Double temperature) {
		this.temperature = temperature;
	}

	public Integer getMaxCompletionTokens() {
		return this.maxCompletionTokens;
	}

	public void setMaxCompletionTokens(Integer maxCompletionTokens) {
		this.maxCompletionTokens = maxCompletionTokens;
	}

}

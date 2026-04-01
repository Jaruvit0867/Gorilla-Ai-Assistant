package com.myproject.ai.gorilla;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import com.myproject.ai.gorilla.config.AdminSecurityProperties;
import com.myproject.ai.gorilla.config.AzureFoundryProperties;
import com.myproject.ai.gorilla.config.AzureSpeechProperties;
import com.myproject.ai.gorilla.config.FrontendProperties;

@SpringBootApplication
@EnableConfigurationProperties({
		AzureFoundryProperties.class,
		AzureSpeechProperties.class,
		AdminSecurityProperties.class,
		FrontendProperties.class
})
public class GorillaApplication {

	public static void main(String[] args) {
		SpringApplication.run(GorillaApplication.class, args);
	}

}

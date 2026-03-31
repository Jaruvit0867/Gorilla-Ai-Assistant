package com.myproject.ai.gorilla.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfiguration {

	private static final String ADMIN_ROLE = "ADMIN";

	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			SecurityContextRepository securityContextRepository) throws Exception {
		http
			.csrf(AbstractHttpConfigurer::disable)
			.cors(Customizer.withDefaults())
			.securityContext((securityContext) -> securityContext
				.securityContextRepository(securityContextRepository))
			.sessionManagement((sessionManagement) -> sessionManagement
				.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
			.authorizeHttpRequests((authorize) -> authorize
				.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
				.requestMatchers("/api/auth/login", "/api/auth/me", "/error").permitAll()
				.requestMatchers("/api/auth/logout").authenticated()
				.requestMatchers("/api/**").hasRole(ADMIN_ROLE)
				.anyRequest().authenticated())
			.formLogin(AbstractHttpConfigurer::disable)
			.httpBasic(AbstractHttpConfigurer::disable)
			.logout(AbstractHttpConfigurer::disable)
			.exceptionHandling((exceptions) -> exceptions
				.authenticationEntryPoint((request, response, authException) -> response.sendError(401))
				.accessDeniedHandler((request, response, accessDeniedException) -> response.sendError(403)));

		return http.build();
	}

	@Bean
	SecurityContextRepository securityContextRepository() {
		HttpSessionSecurityContextRepository repository = new HttpSessionSecurityContextRepository();
		repository.setDisableUrlRewriting(true);
		return repository;
	}

	@Bean
	UserDetailsService userDetailsService(
			AdminSecurityProperties securityProperties,
			PasswordEncoder passwordEncoder) {
		String adminUsername = normalizeRequiredValue(
				securityProperties.getAdminUsername(),
				"ADMIN_USERNAME");
		String adminPassword = normalizeRequiredValue(
				securityProperties.getAdminPassword(),
				"ADMIN_PASSWORD");

		return new InMemoryUserDetailsManager(
				User.withUsername(adminUsername)
					.password(passwordEncoder.encode(adminPassword))
					.roles(ADMIN_ROLE)
					.build());
	}

	@Bean
	AuthenticationManager authenticationManager(
			UserDetailsService userDetailsService,
			PasswordEncoder passwordEncoder) {
		DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
		provider.setPasswordEncoder(passwordEncoder);
		return new ProviderManager(provider);
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(FrontendProperties frontendProperties) {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowCredentials(true);
		configuration.setAllowedOrigins(List.of(normalizeOptionalValue(frontendProperties.getOrigin(), "http://localhost:3000")));
		configuration.setAllowedMethods(List.of("GET", "POST", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("*"));

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}

	private static String normalizeRequiredValue(String value, String envName) {
		String normalized = normalizeOptionalValue(value, null);
		if (normalized == null) {
			throw new IllegalStateException("Missing required configuration. Please set " + envName + ".");
		}
		return normalized;
	}

	private static String normalizeOptionalValue(String value, String fallback) {
		String normalized = trimToNull(value);
		if (normalized == null) {
			return fallback;
		}

		while (normalized.length() >= 2) {
			boolean wrappedInDoubleQuotes = normalized.startsWith("\"") && normalized.endsWith("\"");
			boolean wrappedInSingleQuotes = normalized.startsWith("'") && normalized.endsWith("'");
			if (!wrappedInDoubleQuotes && !wrappedInSingleQuotes) {
				break;
			}
			normalized = trimToNull(normalized.substring(1, normalized.length() - 1));
			if (normalized == null) {
				return fallback;
			}
		}

		return normalized;
	}

	private static String trimToNull(String value) {
		if (value == null) {
			return null;
		}

		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

}

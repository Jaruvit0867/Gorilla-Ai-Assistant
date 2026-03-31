package com.myproject.ai.gorilla.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.myproject.ai.gorilla.dto.AuthSessionResponse;
import com.myproject.ai.gorilla.dto.LoginRequest;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthenticationManager authenticationManager;

	private final SecurityContextRepository securityContextRepository;

	public AuthController(
			AuthenticationManager authenticationManager,
			SecurityContextRepository securityContextRepository) {
		this.authenticationManager = authenticationManager;
		this.securityContextRepository = securityContextRepository;
	}

	@PostMapping("/login")
	@ResponseStatus(HttpStatus.OK)
	public AuthSessionResponse login(
			@RequestBody LoginRequest request,
			HttpServletRequest httpRequest,
			HttpServletResponse httpResponse) {
		String username = normalizeRequestValue(request.username(), "username");
		String password = normalizeRequestValue(request.password(), "password");

		try {
			Authentication authentication = this.authenticationManager.authenticate(
					UsernamePasswordAuthenticationToken.unauthenticated(username, password));
			SecurityContext context = SecurityContextHolder.createEmptyContext();
			context.setAuthentication(authentication);
			SecurityContextHolder.setContext(context);
			this.securityContextRepository.saveContext(context, httpRequest, httpResponse);
			HttpSession session = httpRequest.getSession(true);
			return buildAuthenticatedResponse(authentication, session);
		}
		catch (AuthenticationException exception) {
			SecurityContextHolder.clearContext();
			throw new ResponseStatusException(UNAUTHORIZED, "Invalid admin credentials.", exception);
		}
	}

	@GetMapping("/me")
	@ResponseStatus(HttpStatus.OK)
	public AuthSessionResponse me(Authentication authentication, HttpServletRequest request) {
		HttpSession session = request.getSession(false);
		if (!isAuthenticated(authentication)) {
			return AuthSessionResponse.unauthenticated(session != null ? session.getId() : null);
		}
		return buildAuthenticatedResponse(authentication, session);
	}

	@PostMapping("/logout")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void logout(
			Authentication authentication,
			HttpServletRequest request,
			HttpServletResponse response) {
		new SecurityContextLogoutHandler().logout(request, response, authentication);
	}

	private static AuthSessionResponse buildAuthenticatedResponse(Authentication authentication, HttpSession session) {
		if (authentication == null || !isAuthenticated(authentication)) {
			throw new IllegalStateException("Expected an authenticated principal.");
		}

		String role = AuthorityUtils.authorityListToSet(authentication.getAuthorities())
			.stream()
			.filter((authority) -> authority.startsWith("ROLE_"))
			.map((authority) -> authority.substring("ROLE_".length()))
			.findFirst()
			.orElse(null);
		return new AuthSessionResponse(true, authentication.getName(), role, session != null ? session.getId() : null);
	}

	private static boolean isAuthenticated(Authentication authentication) {
		return authentication != null
				&& authentication.isAuthenticated()
				&& !(authentication instanceof AnonymousAuthenticationToken);
	}

	private static String normalizeRequestValue(String value, String fieldName) {
		if (value == null || value.isBlank()) {
			throw new ResponseStatusException(BAD_REQUEST, "The request field '" + fieldName + "' must not be blank.");
		}
		return value.trim();
	}

}

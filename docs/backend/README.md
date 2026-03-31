# Backend Documentation

## Stack

- Java 25
- Spring Boot 4
- Spring MVC
- Spring Security
- Azure Identity
- Azure AI Foundry via REST

## Main Responsibilities

- authenticate admin users with session-based auth
- protect `/api/**` endpoints with `ROLE_ADMIN`
- keep chat history in `HttpSession`
- send prompts to Azure AI Foundry

## Key Files

- `backend/src/main/java/com/myproject/ai/gorilla/GorillaApplication.java`
- `backend/src/main/java/com/myproject/ai/gorilla/config/SecurityConfiguration.java`
- `backend/src/main/java/com/myproject/ai/gorilla/controller/AuthController.java`
- `backend/src/main/java/com/myproject/ai/gorilla/controller/AiChatController.java`
- `backend/src/main/java/com/myproject/ai/gorilla/service/AzureFoundryChatService.java`
- `backend/src/main/resources/application.properties`

## Request Flow

### Login flow

1. Client calls `POST /api/auth/login`
2. `AuthController.login(...)` authenticates username/password
3. Spring stores the authenticated `SecurityContext` in `HttpSession`
4. Browser receives `JSESSIONID`
5. Later requests reuse that session automatically through the cookie

### Chat flow

1. Client calls `POST /api/ai/chat`
2. `AiChatController.chat(...)` forwards the request and current session
3. `AzureFoundryChatService.generateAnswer(...)` reads chat history from `HttpSession`
4. Service appends the latest user message
5. Service calls Azure AI Foundry `POST /openai/v1/responses`
6. Service extracts the model answer
7. Service stores user and assistant messages back into `HttpSession`
8. Updated history is returned to the client

## Important Classes And Methods

### `SecurityConfiguration`

Purpose:

- defines authentication, authorization, CORS, session behavior, and in-memory admin user

Important methods:

- `securityFilterChain(...)`
  - disables form login and basic auth
  - allows `/api/auth/login`, `/api/auth/me`
  - requires authenticated admin for `/api/**`
- `securityContextRepository()`
  - uses `HttpSessionSecurityContextRepository`
- `userDetailsService(...)`
  - creates the in-memory admin user from `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- `authenticationManager(...)`
  - authenticates login requests against the in-memory user
- `corsConfigurationSource(...)`
  - allows frontend origin from configuration

### `AuthController`

Purpose:

- session login/logout/status endpoints

Important methods:

- `login(...)`
  - validates request body
  - authenticates admin credentials
  - saves Spring Security context into session
- `me(...)`
  - returns current auth state for the existing session
- `logout(...)`
  - clears the current session auth context

### `AiChatController`

Purpose:

- main chat and history endpoints

Important methods:

- `chat(...)`
  - sends prompt to service and returns answer plus updated history
- `history(...)`
  - returns current `HttpSession` history
- `clearHistory(...)`
  - clears chat history for the session

### `AzureFoundryChatService`

Purpose:

- coordinates Azure AI Foundry calls and session chat history

Important methods:

- `generateAnswer(...)`
  - validates prompt
  - resolves Azure config
  - loads history from session
  - builds Foundry request body
  - calls Azure
  - stores updated history
- `getHistory(...)`
  - returns current history snapshot
- `clearHistory(...)`
  - removes the history session attribute
- `parseAgentReference(...)`
  - supports `agent-name` or `agent-name:version`
- `buildResponseRequest(...)`
  - creates the payload sent to Azure
- `buildInputMessages(...)`
  - maps session messages into Foundry input format
- `acquireAccessToken()`
  - gets a token from `DefaultAzureCredential`
- `extractAnswer(...)`
  - reads `output_text` or `output[].content[].text`

## Session Model

- Auth session is stored by Spring Security in `HttpSession`
- Chat history is stored under the internal attribute `CHAT_HISTORY`
- `sessionId` in JSON responses is for diagnostics only
- The real auth mechanism is the `JSESSIONID` cookie

## Current Security Model

- only one role exists right now: `ADMIN`
- credentials are loaded from environment variables
- CSRF is currently disabled
- CORS allows one configured frontend origin

## Required Configuration

Loaded from `backend/src/main/resources/application.properties`:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AZURE_EXISTING_AIPROJECT_ENDPOINT`
- `AZURE_EXISTING_AGENT_ID`
- `FRONTEND_ORIGIN`

Recommended local setup:

```bash
cd backend
cp .env.example .env
```

Useful runtime settings:

- `server.servlet.session.timeout`
- `server.servlet.session.cookie.http-only`
- `server.servlet.session.cookie.same-site`

## Testing

Run:

```bash
cd backend
./mvnw test
```

Important tests:

- context boot test
- auth and session integration test
- AzureFoundryChatService unit tests

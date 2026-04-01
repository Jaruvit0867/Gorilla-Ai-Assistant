# Backend Documentation

## Stack

- Java 25
- Spring Boot 4
- Spring MVC
- Spring Security
- Azure Identity
- Azure AI Foundry via REST
- Azure Speech REST TTS

## Main Responsibilities

- authenticate admin users with session-based auth
- protect `/api/**` endpoints with `ROLE_ADMIN`
- keep chat history in `HttpSession`
- send prompts to Azure AI Foundry
- synthesize assistant replies to audio with Azure Speech

## Key Files

- [GorillaApplication.java](/Users/nn0t/repo/gorilla/backend/src/main/java/com/myproject/ai/gorilla/GorillaApplication.java)
- [SecurityConfiguration.java](/Users/nn0t/repo/gorilla/backend/src/main/java/com/myproject/ai/gorilla/config/SecurityConfiguration.java)
- [AuthController.java](/Users/nn0t/repo/gorilla/backend/src/main/java/com/myproject/ai/gorilla/controller/AuthController.java)
- [AiChatController.java](/Users/nn0t/repo/gorilla/backend/src/main/java/com/myproject/ai/gorilla/controller/AiChatController.java)
- [SpeechController.java](/Users/nn0t/repo/gorilla/backend/src/main/java/com/myproject/ai/gorilla/controller/SpeechController.java)
- [AzureFoundryChatService.java](/Users/nn0t/repo/gorilla/backend/src/main/java/com/myproject/ai/gorilla/service/AzureFoundryChatService.java)
- [AzureSpeechTtsService.java](/Users/nn0t/repo/gorilla/backend/src/main/java/com/myproject/ai/gorilla/service/AzureSpeechTtsService.java)
- [application.properties](/Users/nn0t/repo/gorilla/backend/src/main/resources/application.properties)

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

### TTS flow

1. Client calls `POST /api/speech/tts`
2. `SpeechController.synthesize(...)` validates the request body
3. `AzureSpeechTtsService.synthesize(...)` builds SSML
4. Service calls Azure Speech REST TTS
5. Audio bytes are returned as `audio/mpeg`

## Important Classes And Methods

### `SecurityConfiguration`

Purpose:

- defines authentication, authorization, CORS, and session behavior

Important methods:

- `securityFilterChain(...)`
- `securityContextRepository()`
- `userDetailsService(...)`
- `authenticationManager(...)`
- `corsConfigurationSource(...)`

### `AuthController`

Purpose:

- session login, logout, and status endpoints

Important methods:

- `login(...)`
- `me(...)`
- `logout(...)`

### `AiChatController`

Purpose:

- chat and history endpoints

Important methods:

- `chat(...)`
- `history(...)`
- `clearHistory(...)`

### `SpeechController`

Purpose:

- speech output endpoint

Important methods:

- `synthesize(...)`

### `AzureFoundryChatService`

Purpose:

- coordinates Azure AI Foundry calls and session chat history

Important methods:

- `generateAnswer(...)`
- `getHistory(...)`
- `clearHistory(...)`
- `parseAgentReference(...)`
- `buildResponseRequest(...)`
- `buildInputMessages(...)`
- `acquireAccessToken()`
- `extractAnswer(...)`

### `AzureSpeechTtsService`

Purpose:

- synthesizes assistant text into audio with Azure Speech

Important methods:

- `synthesize(...)`
- `resolveSynthesisUrl(...)`
- `buildSsml(...)`
- `resolveVoiceLocale(...)`
- `normalizeConfigValue(...)`

## Session Model

- auth state is stored by Spring Security in `HttpSession`
- chat history is stored under the `CHAT_HISTORY` session attribute
- `sessionId` in JSON responses is for diagnostics only
- the real auth mechanism is the `JSESSIONID` cookie

## Required Configuration

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AZURE_EXISTING_AIPROJECT_ENDPOINT`
- `AZURE_EXISTING_AGENT_ID`
- `AZURE_LOCATION`
- `AZURE_SPEECH_ENDPOINT`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_VOICE_NAME`
- `FRONTEND_ORIGIN`

## Testing

```bash
cd backend
./mvnw test
```

Current tests cover:

- application boot
- auth and session integration
- Azure AI Foundry service logic
- Azure Speech TTS helper logic

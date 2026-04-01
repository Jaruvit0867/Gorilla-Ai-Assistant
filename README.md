# Gorilla

Gorilla is a full-stack cafe menu assistant with:

- `backend/`: Spring Boot 4 REST API
- `frontend/`: Next.js 16 web client
- Azure AI Foundry for chat responses
- Azure Speech TTS for assistant voice playback
- session-based admin authentication and chat history

## Project Structure

```text
gorilla/
├── backend/
│   ├── src/
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── assets/models/
│   └── .env.local.example
└── docs/
    ├── backend/
    └── frontend/
```

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env
az login
./mvnw spring-boot:run
```

Backend default URL:

```text
http://localhost:8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL:

```text
http://localhost:3000
```

## Important Environment Variables

### Backend

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AZURE_EXISTING_AIPROJECT_ENDPOINT`
- `AZURE_EXISTING_AGENT_ID`
- `AZURE_LOCATION`
- `AZURE_SPEECH_ENDPOINT`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_VOICE_NAME`
- `FRONTEND_ORIGIN`

Notes:

- values should be plain strings
- do not include `export`
- do not wrap values in quotes unless the quote is part of the real value
- use [backend/.env.example](/Users/nn0t/repo/gorilla/backend/.env.example) as the starting point

### Frontend

- `NEXT_PUBLIC_API_BASE_URL`

Example:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## Current Features

- admin login with Spring Security session auth
- session-based chat history with `HttpSession`
- Azure AI Foundry agent chat
- browser-native speech input in Thai
- Azure Speech TTS playback for assistant replies
- Gorilla avatar panel beside the chat UI

## Backend API Summary

Authentication:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Chat:

- `POST /api/ai/chat`
- `GET /api/ai/history`
- `DELETE /api/ai/history`

Speech:

- `POST /api/speech/tts`

## Docker

The backend includes a Docker build in [backend/Dockerfile](/Users/nn0t/repo/gorilla/backend/Dockerfile).

Build an AMD64 image for Azure App Service:

```bash
cd backend
docker buildx build --platform linux/amd64 --load \
  -t nn0t6370/gorilla-backend:latest \
  -t nn0t6370/gorilla-backend:0.0.1 .
```

## Documentation

- backend overview: [docs/backend/README.md](/Users/nn0t/repo/gorilla/docs/backend/README.md)
- backend API: [docs/backend/api.md](/Users/nn0t/repo/gorilla/docs/backend/api.md)
- frontend overview: [docs/frontend/README.md](/Users/nn0t/repo/gorilla/docs/frontend/README.md)

.

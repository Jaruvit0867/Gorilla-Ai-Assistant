# Gorilla

Full-stack chat application with:

- `backend/`: Spring Boot 4 REST API
- `frontend/`: Next.js 16 web client
- Azure AI Foundry integration
- Spring Security session-based admin auth
- `HttpSession` chat history

## Project Structure

```text
gorilla/
├── backend/
│   ├── src/
│   ├── Dockerfile
│   └── .env
├── frontend/
│   ├── src/
│   └── .env.local.example
└── docs/
    ├── backend/
    └── frontend/
```

## Quick Start

### Backend

1. Go to `backend/`
2. Copy `.env.example` to `.env`
3. Fill in `.env`
4. Login to Azure if using local development with `DefaultAzureCredential`
5. Start the app

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

1. Go to `frontend/`
2. Create `.env.local` if needed
3. Start Next.js

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
- `FRONTEND_ORIGIN`

Notes:

- Values should be plain strings.
- Do not include `export`.
- Do not wrap values in `"` unless the quote is part of the real value.
- Safe template file: `backend/.env.example`

### Frontend

- `NEXT_PUBLIC_API_BASE_URL`

Example:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## Authentication Model

This project currently uses session-based authentication.

- `POST /api/auth/login` authenticates the admin user
- Spring returns a `JSESSIONID` cookie
- The browser sends that cookie automatically on later requests
- Protected APIs under `/api/**` require the session

Important:

- The `sessionId` in JSON responses is not a bearer token.
- Real authentication is based on the `JSESSIONID` cookie.

## Backend API Summary

Authentication:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Chat:

- `POST /api/ai/chat`
- `GET /api/ai/history`
- `DELETE /api/ai/history`

## Docker

The backend includes a multi-stage Docker build in [backend/Dockerfile](backend/Dockerfile).

Build an AMD64 image for Azure App Service:

```bash
cd backend
docker buildx build --platform linux/amd64 --load \
  -t nn0t6370/gorilla-backend:latest \
  -t nn0t6370/gorilla-backend:0.0.1 .
```

Push to Docker Hub:

```bash
docker login
docker push nn0t6370/gorilla-backend:latest
docker push nn0t6370/gorilla-backend:0.0.1
```

## Azure Deployment Notes

For Azure Web App custom container, add at least:

- `WEBSITES_PORT=8080`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AZURE_EXISTING_AIPROJECT_ENDPOINT`
- `AZURE_EXISTING_AGENT_ID`
- `FRONTEND_ORIGIN`

If backend uses `DefaultAzureCredential` in Azure:

- enable managed identity on the Web App
- assign the required Azure AI Foundry role to that identity

## Documentation

- Backend docs: [docs/backend/README.md](docs/backend/README.md)
- Backend API docs: [docs/backend/api.md](docs/backend/api.md)
- Frontend docs: [docs/frontend/README.md](docs/frontend/README.md)

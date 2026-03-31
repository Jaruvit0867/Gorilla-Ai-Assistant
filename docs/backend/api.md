# Backend API Reference

## Base URL

Local:

```text
http://localhost:8080
```

## Authentication

This API uses session cookies.

- Login returns a session cookie
- Later requests must reuse that cookie
- `sessionId` in the JSON body is not a bearer token

## `POST /api/auth/login`

Authenticate the admin user.

Request:

```json
{
  "username": "admin",
  "password": "change-me-admin-password"
}
```

Response:

```json
{
  "authenticated": true,
  "username": "admin",
  "role": "ADMIN",
  "sessionId": "ABC123..."
}
```

## `GET /api/auth/me`

Returns the current auth state for the session.

Authenticated response:

```json
{
  "authenticated": true,
  "username": "admin",
  "role": "ADMIN",
  "sessionId": "ABC123..."
}
```

Unauthenticated response:

```json
{
  "authenticated": false,
  "username": null,
  "role": null,
  "sessionId": null
}
```

## `POST /api/auth/logout`

Logs out the current session.

Response:

```text
204 No Content
```

## `POST /api/ai/chat`

Protected endpoint. Requires authenticated admin session.

Request:

```json
{
  "prompt": "สรุปโครงการนี้สั้น ๆ",
  "systemPrompt": "คุณคือผู้ช่วยภาษาไทย",
  "temperature": 0.7,
  "maxOutputTokens": 800
}
```

Notes:

- `prompt` is required
- `systemPrompt`, `temperature`, `maxOutputTokens` are optional
- `threadId` exists in `ChatRequest` but is not used by the current session-based flow

Response:

```json
{
  "answer": "นี่คือคำตอบจากโมเดล",
  "model": "gpt-4.1",
  "responseId": "resp_...",
  "createdAt": "2026-04-01T00:00:00Z",
  "sessionId": "ABC123...",
  "history": [
    {
      "role": "user",
      "content": "สรุปโครงการนี้สั้น ๆ",
      "createdAt": "2026-04-01T00:00:00Z"
    },
    {
      "role": "assistant",
      "content": "นี่คือคำตอบจากโมเดล",
      "createdAt": "2026-04-01T00:00:01Z"
    }
  ],
  "agentId": "test:2",
  "agentName": "test"
}
```

## `GET /api/ai/history`

Protected endpoint. Returns chat history for the current session.

Response:

```json
{
  "sessionId": "ABC123...",
  "messages": [
    {
      "role": "user",
      "content": "สวัสดี",
      "createdAt": "2026-04-01T00:00:00Z"
    },
    {
      "role": "assistant",
      "content": "สวัสดีค่ะ",
      "createdAt": "2026-04-01T00:00:01Z"
    }
  ]
}
```

## `DELETE /api/ai/history`

Protected endpoint. Clears current session history.

Response:

```json
{
  "sessionId": "ABC123...",
  "messages": []
}
```

## Error Behavior

Typical statuses:

- `200` success
- `204` logout success
- `400` invalid request body
- `401` unauthenticated
- `403` authenticated but not authorized
- `502` upstream Azure AI Foundry failure
- `503` missing configuration

# Frontend Documentation

## Stack

- Next.js 16
- React 19
- TypeScript
- CSS Modules

## Main Responsibilities

- show login form for admin auth
- keep UI state for current page
- reuse backend session cookie automatically
- display chat history returned by backend
- send prompts to backend

## Key Files

- `frontend/src/app/page.tsx`
- `frontend/src/app/page.module.css`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/globals.css`
- `frontend/.env.local.example`

## Integration Model

The frontend does not manage tokens manually.

- it calls backend endpoints with `fetch`
- requests use `credentials: "include"`
- browser stores and reuses `JSESSIONID`
- backend owns authentication and chat history

## Page Flow

1. page loads
2. frontend calls `/api/auth/me`
3. if authenticated, frontend calls `/api/ai/history`
4. user can send messages with `/api/ai/chat`
5. user can clear history with `DELETE /api/ai/history`
6. user can logout with `POST /api/auth/logout`

## Important Functions In `page.tsx`

### `requestJson(...)`

Purpose:

- shared wrapper for all HTTP requests
- sends `credentials: "include"`
- parses JSON
- throws readable errors when request fails

### `refreshSession`

Purpose:

- called on first render
- checks whether user is already authenticated
- loads chat history when session exists

### `handleLogin(...)`

Purpose:

- sends admin credentials to `/api/auth/login`
- refreshes history after login succeeds

### `handleLogout()`

Purpose:

- logs out current session
- clears local UI state

### `handleReset()`

Purpose:

- clears backend chat history for the current session
- clears the visible chat area

### `handleSend(...)`

Purpose:

- sends the current prompt to `/api/ai/chat`
- updates message list from the returned `history`

## State Stored In The Frontend

Main state values:

- `auth`
- `messages`
- `prompt`
- `username`
- `password`
- `latestMeta`
- `error`
- `authPending`
- `chatPending`

Important note:

- chat history source of truth is the backend session
- frontend only renders the returned history

## Environment Variables

Use `.env.local` when needed.

Available public variable:

- `NEXT_PUBLIC_API_BASE_URL`

Example:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## Commands

Install dependencies:

```bash
cd frontend
npm install
```

Start dev server:

```bash
npm run dev
```

Build production bundle:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Notes For Future Work

- if backend moves to CSRF protection, this page will need to send the CSRF token
- if backend changes from session auth to JWT, request handling will need to change
- if chat becomes multi-page or multi-feature, `page.tsx` should be split into smaller components

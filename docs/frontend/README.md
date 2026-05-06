# Frontend Documentation

## Stack

- Next.js 16
- React 19
- TypeScript
- CSS Modules
- Three.js via `@react-three/fiber`

## Main Responsibilities

- show the admin login page
- render chat history returned by the backend
- send prompts to the backend with streaming chat responses
- capture browser speech input in Thai
- play assistant replies through Azure Speech TTS audio
- render the Gorilla avatar beside the chat

## Key Files

- [page.tsx](/Users/nn0t/repo/gorilla/frontend/src/app/page.tsx)
- [page.module.css](/Users/nn0t/repo/gorilla/frontend/src/app/page.module.css)
- [layout.tsx](/Users/nn0t/repo/gorilla/frontend/src/app/layout.tsx)
- [globals.css](/Users/nn0t/repo/gorilla/frontend/src/app/globals.css)
- [gorilla-avatar-stage.tsx](/Users/nn0t/repo/gorilla/frontend/src/components/gorilla-avatar-stage.tsx)

## Integration Model

- the frontend calls backend endpoints with `fetch`
- every request uses `credentials: "include"`
- the browser stores and reuses `JSESSIONID`
- the backend owns authentication and chat history

## Page Flow

1. page loads
2. frontend calls `/api/auth/me`
3. if authenticated, frontend calls `/api/ai/history`
4. user can type and send messages with `/api/ai/chat/stream`
5. user can use browser speech input to fill the prompt field
6. assistant replies are spoken with `/api/speech/tts`
7. user can clear history with `DELETE /api/ai/history`
8. user can logout with `POST /api/auth/logout`

## Important Functions In `page.tsx`

### `requestJson(...)`

- shared wrapper for JSON API requests
- sends `credentials: "include"`
- throws readable errors when the request fails

### `requestAudio(...)`

- calls the TTS endpoint
- returns audio as a `Blob`

### `refreshSession`

- checks whether the current browser session is authenticated
- loads chat history when a session already exists

### `submitPrompt(...)`

- sends the prompt to `/api/ai/chat/stream`
- appends `delta` events into the current assistant bubble
- updates visible history from the final `done` event
- triggers audio playback for the assistant reply

### `readSseStream(...)`

- reads backend Server-Sent Events from a `fetch` response body
- supports `delta`, `done`, and `error` events
- lets the chat render progressively like Foundry Playground

### `startSpeechCapture()` and `stopSpeechCapture()`

- use browser speech recognition
- fill the textarea with recognized Thai speech
- stop automatically after 5 seconds with no new input

### `speakAssistantAnswer(...)`

- requests MP3 audio from `/api/speech/tts`
- plays the audio in the browser
- keeps the avatar in speaking mode while audio is playing

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
- `speechSupported`
- `speechActive`
- `avatarSpeaking`

Important note:

- chat history source of truth is the backend session
- the frontend only renders the history returned by the backend

## Environment Variables

Use `.env.local` when needed.

- `NEXT_PUBLIC_API_BASE_URL`

Example:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## Commands

```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
```

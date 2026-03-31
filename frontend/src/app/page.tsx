"use client";

import { FormEvent, useEffect, useEffectEvent, useMemo, useState } from "react";
import styles from "./page.module.css";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string | null;
};

type ChatHistoryResponse = {
  sessionId: string;
  messages: ChatMessage[];
};

type AuthSessionResponse = {
  authenticated: boolean;
  username: string | null;
  role: string | null;
  sessionId: string | null;
};

type ChatResponse = {
  answer: string;
  model: string;
  responseId: string;
  createdAt: string;
  sessionId: string;
  history: ChatMessage[];
  agentId: string;
  agentName: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

export default function Home() {
  const [auth, setAuth] = useState<AuthSessionResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [latestMeta, setLatestMeta] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authPending, setAuthPending] = useState(true);
  const [chatPending, setChatPending] = useState(false);

  const canSend = useMemo(
    () => Boolean(auth?.authenticated) && prompt.trim().length > 0 && !chatPending,
    [auth?.authenticated, chatPending, prompt],
  );

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T | null> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (response.status === 204) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!response.ok) {
      const reason =
        typeof payload?.message === "string"
          ? payload.message
          : typeof payload?.error === "string"
            ? payload.error
            : `Request failed with status ${response.status}`;
      throw new Error(reason);
    }

    return payload as T;
  }

  const refreshSession = useEffectEvent(async () => {
    setAuthPending(true);
    setError(null);

    try {
      const session = await requestJson<AuthSessionResponse>("/api/auth/me", {
        method: "GET",
      });

      setAuth(session);

      if (session?.authenticated) {
        const history = await requestJson<ChatHistoryResponse>("/api/ai/history", {
          method: "GET",
        });
        setMessages(history?.messages ?? []);
      } else {
        setMessages([]);
        setLatestMeta(null);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, "โหลดสถานะ session ไม่สำเร็จ"));
    } finally {
      setAuthPending(false);
    }
  });

  useEffect(() => {
    void refreshSession();
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthPending(true);
    setError(null);

    try {
      const session = await requestJson<AuthSessionResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      setAuth(session);
      setPassword("");

      const history = await requestJson<ChatHistoryResponse>("/api/ai/history", {
        method: "GET",
      });
      setMessages(history?.messages ?? []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "ล็อกอินไม่สำเร็จ"));
    } finally {
      setAuthPending(false);
    }
  }

  async function handleLogout() {
    setAuthPending(true);
    setError(null);

    try {
      await requestJson("/api/auth/logout", { method: "POST" });
      setAuth(unauthenticatedSession());
      setMessages([]);
      setLatestMeta(null);
      setPrompt("");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "ออกจากระบบไม่สำเร็จ"));
    } finally {
      setAuthPending(false);
    }
  }

  async function handleReset() {
    setChatPending(true);
    setError(null);

    try {
      const history = await requestJson<ChatHistoryResponse>("/api/ai/history", {
        method: "DELETE",
      });
      setMessages(history?.messages ?? []);
      setLatestMeta(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "ล้างประวัติแชตไม่สำเร็จ"));
    } finally {
      setChatPending(false);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    setChatPending(true);
    setError(null);

    try {
      const response = await requestJson<ChatResponse>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt.trim(),
        }),
      });

      if (response) {
        setMessages(response.history);
        setLatestMeta(response);
      }
      setPrompt("");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "ส่งข้อความไม่สำเร็จ"));
    } finally {
      setChatPending(false);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Gorilla Chat</h1>
            <p className={styles.subtle}>
              {auth?.authenticated
                ? `${auth.username} • ${auth.role}`
                : authPending
                  ? "Checking session"
                  : "Admin sign in"}
            </p>
          </div>

          <div className={styles.topbarActions}>
            {latestMeta?.model ? <span className={styles.pill}>{latestMeta.model}</span> : null}
            <span className={styles.pillMuted}>
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </span>
            {auth?.authenticated ? (
              <>
                <button
                  className={styles.secondaryButton}
                  disabled={chatPending}
                  onClick={handleReset}
                  type="button"
                >
                  Reset
                </button>
                <button
                  className={styles.ghostButton}
                  disabled={authPending}
                  onClick={handleLogout}
                  type="button"
                >
                  Logout
                </button>
              </>
            ) : null}
          </div>
        </header>

        {error ? <p className={styles.errorBanner}>{error}</p> : null}

        {auth?.authenticated ? (
          <>
            <section className={styles.chatTimeline}>
              {messages.length === 0 ? (
                <div className={styles.emptyState}>เริ่มแชตได้เลย</div>
              ) : (
                messages.map((message, index) => (
                  <article
                    className={
                      message.role === "user"
                        ? styles.userMessage
                        : styles.assistantMessage
                    }
                    key={`${message.createdAt ?? "message"}-${index}`}
                  >
                    <div className={styles.messageMeta}>
                      <span>{message.role === "user" ? "You" : "Assistant"}</span>
                      <time>{formatTimestamp(message.createdAt)}</time>
                    </div>
                    <p>{message.content}</p>
                  </article>
                ))
              )}
            </section>

            <form className={styles.composer} onSubmit={handleSend}>
              <textarea
                className={styles.promptInput}
                disabled={chatPending}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="พิมพ์ข้อความ..."
                rows={4}
                value={prompt}
              />
              <div className={styles.composerFooter}>
                <span className={styles.subtle}>
                  {chatPending ? "Generating..." : "Ready"}
                </span>
                <button className={styles.primaryButton} disabled={!canSend} type="submit">
                  {chatPending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <section className={styles.loginCard}>
            <form className={styles.loginForm} onSubmit={handleLogin}>
              <label className={styles.field}>
                <span>Username</span>
                <input
                  autoComplete="username"
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  value={username}
                />
              </label>
              <label className={styles.field}>
                <span>Password</span>
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="password"
                  type="password"
                  value={password}
                />
              </label>
              <button className={styles.primaryButton} disabled={authPending} type="submit">
                {authPending ? "Signing In..." : "Sign In"}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function unauthenticatedSession(): AuthSessionResponse {
  return {
    authenticated: false,
    username: null,
    role: null,
    sessionId: null,
  };
}

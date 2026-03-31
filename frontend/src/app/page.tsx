"use client";

import {
  FormEvent,
  PointerEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
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

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
  length: number;
};

type SpeechRecognitionResultListLike = {
  [index: number]: SpeechRecognitionResultLike;
  length: number;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

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
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("ยังไม่พร้อมใช้งาน");

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const holdActiveRef = useRef(false);
  const manualStopRef = useRef(false);
  const restartTimeoutRef = useRef<number | null>(null);
  const promptRef = useRef("");
  const speechBasePromptRef = useRef("");

  const canSend = useMemo(
    () =>
      Boolean(auth?.authenticated) &&
      prompt.trim().length > 0 &&
      !chatPending &&
      !speechActive,
    [auth?.authenticated, chatPending, prompt, speechActive],
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

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionConstructor) {
      setSpeechSupported(false);
      setSpeechStatus("เบราว์เซอร์นี้ไม่รองรับการพูดเป็นข้อความ");
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = "th-TH";

    recognition.onstart = () => {
      setSpeechActive(true);
      setSpeechStatus("กำลังฟัง...");
    };

    recognition.onresult = (event) => {
      const transcript = extractTranscript(event.results).trim();
      if (!transcript) {
        return;
      }

      setPrompt(mergeSpeechPrompt(speechBasePromptRef.current, transcript));
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        setSpeechStatus("ไม่พบเสียงพูด");
        return;
      }

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        holdActiveRef.current = false;
        setSpeechStatus("ยังไม่ได้รับสิทธิ์ไมโครโฟน");
        setError("เบราว์เซอร์ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน");
        return;
      }

      holdActiveRef.current = false;
      setSpeechStatus("เกิดข้อผิดพลาดในการรับเสียง");
      setError("เริ่มรับเสียงไม่สำเร็จ ลองใหม่อีกครั้ง");
    };

    recognition.onend = () => {
      setSpeechActive(false);

      if (holdActiveRef.current && !manualStopRef.current) {
        speechBasePromptRef.current = promptRef.current.trim();
        restartTimeoutRef.current = window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            holdActiveRef.current = false;
            setSpeechStatus("กดค้างเพื่อพูด");
          }
        }, 120);
        return;
      }

      holdActiveRef.current = false;
      manualStopRef.current = false;
      setSpeechStatus("กดค้างเพื่อพูด");
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);
    setSpeechStatus("กดค้างเพื่อพูด");

    return () => {
      holdActiveRef.current = false;
      manualStopRef.current = true;

      if (restartTimeoutRef.current !== null) {
        window.clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }

      try {
        recognition.abort();
      } catch {
        // Ignore teardown errors from browser speech engines.
      }

      recognitionRef.current = null;
    };
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

  function handleClearPrompt() {
    setPrompt("");
    promptRef.current = "";
    speechBasePromptRef.current = "";
    setError(null);
    if (!speechActive && speechSupported) {
      setSpeechStatus("กดค้างเพื่อพูด");
    }
  }

  function handleSpeechPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    if (!speechSupported || speechActive || !auth?.authenticated || chatPending) {
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      setSpeechStatus("ยังไม่พร้อมใช้งาน");
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    holdActiveRef.current = true;
    manualStopRef.current = false;
    speechBasePromptRef.current = prompt.trim();
    setError(null);
    setSpeechStatus("กำลังเปิดไมโครโฟน...");

    try {
      recognition.start();
    } catch {
      holdActiveRef.current = false;
      setSpeechStatus("ระบบรับเสียงกำลังทำงาน ลองใหม่อีกครั้ง");
    }
  }

  function handleSpeechPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopSpeechCapture();
  }

  function handleSpeechLostPointerCapture() {
    stopSpeechCapture();
  }

  function stopSpeechCapture() {
    holdActiveRef.current = false;
    manualStopRef.current = true;

    if (restartTimeoutRef.current !== null) {
      window.clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      setSpeechActive(false);
      setSpeechStatus(speechSupported ? "กดค้างเพื่อพูด" : "ยังไม่พร้อมใช้งาน");
      return;
    }

    try {
      recognition.stop();
    } catch {
      setSpeechActive(false);
      setSpeechStatus(speechSupported ? "กดค้างเพื่อพูด" : "ยังไม่พร้อมใช้งาน");
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Gorilla AI Assistant</h1>
            <p className={styles.subtle}>
              {auth?.authenticated
                ? `${auth.username} • ${auth.role}`
                : authPending
                  ? "กำลังตรวจสอบเซสชัน"
                  : "เข้าสู่ระบบผู้ดูแล"}
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
                  ล้างแชต
                </button>
                <button
                  className={styles.ghostButton}
                  disabled={authPending}
                  onClick={handleLogout}
                  type="button"
                >
                  ออกจากระบบ
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
                      <span>{message.role === "user" ? "คุณ" : "ผู้ช่วย"}</span>
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
                <div className={styles.speechGroup}>
                  <button
                    aria-label="Hold to speak"
                    className={`${styles.speechButton} ${
                      speechActive ? styles.speechButtonActive : ""
                    }`}
                  disabled={!speechSupported || !auth?.authenticated || chatPending}
                  onLostPointerCapture={handleSpeechLostPointerCapture}
                  onPointerCancel={handleSpeechLostPointerCapture}
                  onPointerDown={handleSpeechPointerDown}
                  onPointerUp={handleSpeechPointerUp}
                  type="button"
                >
                  <span className={styles.speechButtonIcon}>●</span>
                  <span className={styles.speechButtonLabel}>
                      {speechActive ? "ปล่อยเพื่อหยุด" : "กดค้างเพื่อพูด"}
                    </span>
                  </button>
                  <span className={styles.subtle}>{chatPending ? "กำลังสร้างคำตอบ..." : speechStatus}</span>
                </div>
                <div className={styles.composerActions}>
                  <button
                    className={styles.secondaryButton}
                    disabled={chatPending || prompt.trim().length === 0}
                    onClick={handleClearPrompt}
                    type="button"
                  >
                    ล้างข้อความ
                  </button>
                  <button className={styles.primaryButton} disabled={!canSend} type="submit">
                    {chatPending ? "กำลังส่ง..." : "ส่งข้อความ"}
                  </button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <section className={styles.loginCard}>
            <form className={styles.loginForm} onSubmit={handleLogin}>
              <label className={styles.field}>
                <span>ชื่อผู้ใช้</span>
                <input
                  autoComplete="username"
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  value={username}
                />
              </label>
              <label className={styles.field}>
                <span>รหัสผ่าน</span>
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  type="password"
                  value={password}
                />
              </label>
              <button className={styles.primaryButton} disabled={authPending} type="submit">
                {authPending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return constructor ?? null;
}

function extractTranscript(results: SpeechRecognitionResultListLike) {
  let transcript = "";

  for (let index = 0; index < results.length; index += 1) {
    transcript += results[index]?.[0]?.transcript ?? "";
  }

  return transcript;
}

function mergeSpeechPrompt(basePrompt: string, transcript: string) {
  const normalizedBase = basePrompt.trim();
  const normalizedTranscript = transcript.trim();

  if (!normalizedBase) {
    return normalizedTranscript;
  }

  if (!normalizedTranscript) {
    return normalizedBase;
  }

  return `${normalizedBase} ${normalizedTranscript}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "เมื่อสักครู่";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "เมื่อสักครู่";
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

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

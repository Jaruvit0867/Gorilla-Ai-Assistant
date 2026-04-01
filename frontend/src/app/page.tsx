"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import bannerImage from "../../assets/pictures/banner.jpg";
import logoImage from "../../assets/pictures/logo.png";
import type { AvatarMode } from "../components/gorilla-avatar-stage";
import styles from "./page.module.css";

const GorillaAvatarStage = dynamic(() => import("../components/gorilla-avatar-stage"), {
  ssr: false,
  loading: () => <div className={styles.avatarFallback} />,
});

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

const apiBaseUrl = resolveApiBaseUrl();

const SPEECH_IDLE_AUTO_STOP_MS = 5_000;
const SPEECH_HOLD_START_DELAY_MS = 180;

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
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const promptRef = useRef("");
  const speechBasePromptRef = useRef("");
  const speechHoldStartTimeoutRef = useRef<number | null>(null);
  const speechHoldTriggeredRef = useRef(false);
  const speechIdleTimeoutRef = useRef<number | null>(null);
  const speechHeardInputRef = useRef(false);
  const speechKeyHoldRef = useRef(false);
  const assistantSpeakTimeoutRef = useRef<number | null>(null);
  const assistantAudioRef = useRef<HTMLAudioElement | null>(null);
  const assistantAudioUrlRef = useRef<string | null>(null);
  const assistantSpeechAbortRef = useRef<AbortController | null>(null);

  const canSend = useMemo(
    () =>
      Boolean(auth?.authenticated) &&
      prompt.trim().length > 0 &&
      !chatPending &&
      !speechActive,
    [auth?.authenticated, chatPending, prompt, speechActive],
  );

  const avatarMode = useMemo<AvatarMode>(() => {
    if (speechActive) {
      return "listening";
    }

    if (chatPending) {
      return "thinking";
    }

    if (avatarSpeaking) {
      return "speaking";
    }

    return "idle";
  }, [avatarSpeaking, chatPending, speechActive]);

  const speechButtonLabel = useMemo(() => {
    if (!speechSupported) {
      return "ไม่รองรับการพูด";
    }

    return speechActive ? "ปล่อยเพื่อหยุด" : "กดค้างเพื่อพูด";
  }, [speechActive, speechSupported]);

  const isAuthenticated = Boolean(auth?.authenticated);

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

  async function requestAudio(path: string, init?: RequestInit): Promise<Blob> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const rawError = await response.text().catch(() => "");
      let reason = `Request failed with status ${response.status}`;

      if (rawError) {
        try {
          const payload = JSON.parse(rawError) as Record<string, unknown>;
          reason =
            typeof payload.message === "string"
              ? payload.message
              : typeof payload.error === "string"
                ? payload.error
                : rawError;
        } catch {
          reason = rawError;
        }
      }

      throw new Error(reason);
    }

    return response.blob();
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

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionConstructor) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = "th-TH";

    recognition.onstart = () => {
      speechHeardInputRef.current = false;
      setSpeechActive(true);
      scheduleSpeechIdleTimeout();
    };

    recognition.onresult = (event) => {
      const transcript = extractTranscript(event.results).trim();
      if (!transcript) {
        return;
      }

      speechHeardInputRef.current = true;
      setPrompt(mergeSpeechPrompt(speechBasePromptRef.current, transcript));
      scheduleSpeechIdleTimeout();
    };

    recognition.onerror = (event) => {
      clearSpeechIdleTimeout();

      if (event.error === "no-speech") {
        return;
      }

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("เบราว์เซอร์ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน");
        return;
      }

      setError("เริ่มรับเสียงไม่สำเร็จ ลองใหม่อีกครั้ง");
    };

    recognition.onend = () => {
      clearSpeechIdleTimeout();
      setSpeechActive(false);
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      clearSpeechIdleTimeout();

      try {
        recognition.abort();
      } catch {
        // Ignore teardown errors from browser speech engines.
      }

      recognitionRef.current = null;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    return () => {
      if (assistantSpeakTimeoutRef.current !== null) {
        window.clearTimeout(assistantSpeakTimeoutRef.current);
      }

      clearSpeechHoldStartTimeout();
      clearSpeechIdleTimeout();
      stopSpeechCapture();
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  function clearSpeechHoldStartTimeout() {
    if (speechHoldStartTimeoutRef.current !== null) {
      window.clearTimeout(speechHoldStartTimeoutRef.current);
      speechHoldStartTimeoutRef.current = null;
    }
  }

  function clearSpeechIdleTimeout() {
    if (speechIdleTimeoutRef.current !== null) {
      window.clearTimeout(speechIdleTimeoutRef.current);
      speechIdleTimeoutRef.current = null;
    }
  }

  function scheduleSpeechIdleTimeout() {
    clearSpeechIdleTimeout();
    speechIdleTimeoutRef.current = window.setTimeout(() => {
      stopSpeechCapture();
    }, SPEECH_IDLE_AUTO_STOP_MS);
  }

  function stopAssistantSpeaking() {
    assistantSpeechAbortRef.current?.abort();
    assistantSpeechAbortRef.current = null;

    const currentAudio = assistantAudioRef.current;
    if (currentAudio) {
      currentAudio.onplay = null;
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.onpause = null;
      currentAudio.pause();
      currentAudio.src = "";
      assistantAudioRef.current = null;
    }

    if (assistantAudioUrlRef.current) {
      URL.revokeObjectURL(assistantAudioUrlRef.current);
      assistantAudioUrlRef.current = null;
    }

    if (assistantSpeakTimeoutRef.current !== null) {
      window.clearTimeout(assistantSpeakTimeoutRef.current);
      assistantSpeakTimeoutRef.current = null;
    }

    setAvatarSpeaking(false);
  }

  function startAssistantTextAnimation(text: string) {
    stopAssistantSpeaking();

    const speakingDuration = Math.min(9000, Math.max(3200, text.trim().length * 42));
    setAvatarSpeaking(true);
    assistantSpeakTimeoutRef.current = window.setTimeout(() => {
      assistantSpeakTimeoutRef.current = null;
      setAvatarSpeaking(false);
    }, speakingDuration);
  }

  async function speakAssistantAnswer(text: string) {
    stopAssistantSpeaking();

    const normalizedText = text.trim();
    if (!normalizedText) {
      return;
    }

    const abortController = new AbortController();
    assistantSpeechAbortRef.current = abortController;

    try {
      const audioBlob = await requestAudio("/api/speech/tts", {
        method: "POST",
        body: JSON.stringify({ text: normalizedText }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortController.signal,
      });

      if (abortController.signal.aborted || audioBlob.size === 0) {
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      assistantAudioUrlRef.current = audioUrl;
      assistantAudioRef.current = audio;

      const cleanup = () => {
        if (assistantAudioRef.current === audio) {
          assistantAudioRef.current = null;
        }

        if (assistantAudioUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          assistantAudioUrlRef.current = null;
        }

        if (assistantSpeechAbortRef.current === abortController) {
          assistantSpeechAbortRef.current = null;
        }

        setAvatarSpeaking(false);
      };

      audio.preload = "auto";
      audio.onplay = () => setAvatarSpeaking(true);
      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.onpause = () => {
        if (!audio.ended) {
          cleanup();
        }
      };

      await audio.play();
    } catch (requestError) {
      if (!abortController.signal.aborted) {
        throw requestError;
      }
    }
  }

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
      stopSpeechCapture();
      stopAssistantSpeaking();
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
      stopSpeechCapture();
      stopAssistantSpeaking();
      const history = await requestJson<ChatHistoryResponse>("/api/ai/history", {
        method: "DELETE",
      });
      setMessages(history?.messages ?? []);
      setLatestMeta(null);
      setPrompt("");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "ล้างประวัติแชตไม่สำเร็จ"));
    } finally {
      setChatPending(false);
    }
  }

  async function submitPrompt(nextPrompt: string) {
    const normalizedPrompt = nextPrompt.trim();
    if (!auth?.authenticated || normalizedPrompt.length === 0 || chatPending) {
      return;
    }

    setChatPending(true);
    setError(null);
    stopAssistantSpeaking();

    try {
      const response = await requestJson<ChatResponse>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          prompt: normalizedPrompt,
        }),
      });

      if (response) {
        setMessages(response.history);
        setLatestMeta(response);
        void speakAssistantAnswer(response.answer).catch((ttsError) => {
          console.error("Azure Speech TTS playback failed", ttsError);
          startAssistantTextAnimation(response.answer);
        });
      }

      setPrompt("");
      promptRef.current = "";
      speechBasePromptRef.current = "";
    } catch (requestError) {
      setError(getErrorMessage(requestError, "ส่งข้อความไม่สำเร็จ"));
    } finally {
      setChatPending(false);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    await submitPrompt(prompt);
  }

  function handleClearPrompt() {
    setPrompt("");
    promptRef.current = "";
    speechBasePromptRef.current = "";
    setError(null);
  }

  function startSpeechCapture() {
    if (!speechSupported || !auth?.authenticated || chatPending || speechActive) {
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      setError("ตัวรับเสียงยังไม่พร้อมใช้งาน");
      return;
    }

    speechBasePromptRef.current = promptRef.current.trim();
    speechHeardInputRef.current = false;
    setError(null);
    stopAssistantSpeaking();

    try {
      recognition.start();
    } catch {
      setError("ระบบรับเสียงกำลังทำงาน ลองใหม่อีกครั้ง");
    }
  }

  function stopSpeechCapture() {
    clearSpeechHoldStartTimeout();
    clearSpeechIdleTimeout();

    const recognition = recognitionRef.current;
    if (!recognition) {
      setSpeechActive(false);
      return;
    }

    try {
      recognition.stop();
    } catch {
      setSpeechActive(false);
    }
  }

  function handleSpeechHoldStart(event?: ReactPointerEvent<HTMLButtonElement>) {
    if (!auth?.authenticated || chatPending) {
      return;
    }

    if (event) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    if (speechActive) {
      return;
    }

    clearSpeechHoldStartTimeout();
    speechHoldTriggeredRef.current = false;
    speechHoldStartTimeoutRef.current = window.setTimeout(() => {
      speechHoldStartTimeoutRef.current = null;
      speechHoldTriggeredRef.current = true;
      startSpeechCapture();
    }, SPEECH_HOLD_START_DELAY_MS);
  }

  function handleSpeechHoldEnd(event?: ReactPointerEvent<HTMLButtonElement>) {
    if (event) {
      event.preventDefault();

      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    clearSpeechHoldStartTimeout();

    if (!speechHoldTriggeredRef.current) {
      return;
    }

    speechHoldTriggeredRef.current = false;
    stopSpeechCapture();
  }

  function handleSpeechKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (speechKeyHoldRef.current) {
      return;
    }

    speechKeyHoldRef.current = true;
    handleSpeechHoldStart();
  }

  function handleSpeechKeyUp(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    speechKeyHoldRef.current = false;
    handleSpeechHoldEnd();
  }

  return (
    <div className={styles.page}>
      <main className={`${styles.shell} ${isAuthenticated ? styles.shellChat : ""}`}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.brandLockup}>
              <div className={styles.brandLogo}>
                <Image alt="Gorilla logo" priority sizes="88px" src={logoImage} />
              </div>
              <div className={styles.brandText}>
                <h1>Gorilla</h1>
                {auth?.authenticated ? (
                  <p className={styles.subtle}>{`${auth.username} · ${auth.role}`}</p>
                ) : null}
              </div>
            </div>
          </div>

          {auth?.authenticated ? (
            <div className={styles.topbarActions}>
              {latestMeta?.model ? (
                <span className={styles.infoChip}>โมเดล {latestMeta.model}</span>
              ) : null}
              <span className={styles.infoChipMuted}>{messages.length} ข้อความ</span>
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
            </div>
          ) : null}
        </header>

        <section className={`${styles.mainContent} ${isAuthenticated ? styles.mainContentChat : ""}`}>
          <div className={styles.errorSlot}>{error ? <p className={styles.errorBanner}>{error}</p> : null}</div>

          {auth?.authenticated ? (
            <section className={`${styles.workspace} ${styles.workspaceCompact}`}>
              <section className={`${styles.card} ${styles.chatPanel}`}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelText}>
                    <p className={styles.panelEyebrow}>Chat</p>
                    <h2>แชตกับ Gorilla</h2>
                  </div>
                </div>

                <section className={styles.chatArea}>
                  <div className={styles.chatTimeline}>
                    {messages.length === 0 ? (
                      <div className={styles.emptyState}>พิมพ์ข้อความหรือกดเพื่อเริ่มพูด</div>
                    ) : (
                      messages.map((message, index) => (
                        <article
                          className={
                            message.role === "user" ? styles.userMessage : styles.gorillaMessage
                          }
                          key={`${message.createdAt ?? "message"}-${message.role}-${index}`}
                        >
                          <div className={styles.messageMeta}>
                            <span>{message.role === "user" ? "คุณ" : "Gorilla"}</span>
                            <time>{formatTimestamp(message.createdAt)}</time>
                          </div>
                          <p>{message.content}</p>
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <form className={styles.composer} onSubmit={handleSend}>
                  <textarea
                    className={styles.promptInput}
                    disabled={chatPending}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="พิมพ์ข้อความหรือกดเพื่อเริ่มพูด..."
                    rows={4}
                    value={prompt}
                  />

                  <div className={styles.composerFooter}>
                    <button
                      aria-label={speechActive ? "Release to stop speech to text" : "Hold to start speech to text"}
                      className={`${styles.speechButton} ${
                        speechActive ? styles.speechButtonActive : ""
                      }`}
                      disabled={!speechSupported || !auth?.authenticated || chatPending}
                      onBlur={() => {
                        speechKeyHoldRef.current = false;
                        handleSpeechHoldEnd();
                      }}
                      onKeyDown={handleSpeechKeyDown}
                      onKeyUp={handleSpeechKeyUp}
                      onPointerCancel={handleSpeechHoldEnd}
                      onPointerDown={handleSpeechHoldStart}
                      onPointerLeave={handleSpeechHoldEnd}
                      onPointerUp={handleSpeechHoldEnd}
                      type="button"
                    >
                      <span className={styles.speechButtonLabel}>{speechButtonLabel}</span>
                    </button>

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
              </section>

              <aside className={`${styles.card} ${styles.avatarPanel}`}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelText}>
                    <p className={styles.panelEyebrow}>Avatar</p>
                    <h2>Gorilla</h2>
                  </div>
                </div>

                <div className={styles.avatarStageWrap}>
                  <Image
                    alt=""
                    className={styles.stageBanner}
                    fill
                    priority
                    sizes="(max-width: 1160px) 100vw, 42vw"
                    src={bannerImage}
                  />
                  <div className={styles.stageShade} />
                  <div className={styles.stageLogoMark}>
                    <Image alt="" sizes="96px" src={logoImage} />
                  </div>
                  <GorillaAvatarStage mode={avatarMode} />
                </div>
              </aside>
            </section>
          ) : (
            <section className={styles.loginLayout}>
              <div className={`${styles.card} ${styles.loginCard}`}>
                <div className={styles.loginHeader}>
                  <p className={styles.panelEyebrow}>Admin Login</p>
                  <h2 className={styles.loginTitle}>เข้าสู่ระบบ</h2>
                </div>

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
              </div>

              <aside className={`${styles.card} ${styles.loginPreview}`}>
                <div className={styles.panelText}>
                  <p className={styles.panelEyebrow}>Preview</p>
                  <h2>Gorilla Avatar</h2>
                </div>
                <div className={styles.loginStageWrap}>
                  <Image
                    alt=""
                    className={styles.stageBanner}
                    fill
                    priority
                    sizes="(max-width: 1160px) 100vw, 45vw"
                    src={bannerImage}
                  />
                  <div className={styles.stageShade} />
                  <div className={styles.stageLogoMark}>
                    <Image alt="" sizes="96px" src={logoImage} />
                  </div>
                  <GorillaAvatarStage mode="idle" />
                </div>
              </aside>
            </section>
          )}
        </section>
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

function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8080";
    }
  }

  return "";
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

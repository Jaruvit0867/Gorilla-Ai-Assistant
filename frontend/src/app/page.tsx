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
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_META,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  TRANSLATIONS,
  isLanguage,
  resolveBrowserLanguage,
  type Language,
} from "../lib/i18n";
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

type ChatStreamEvent = {
  event: string | null;
  data: string | null;
};

type ChatStreamDelta = {
  text: string;
};

type ChatStreamError = {
  message: string;
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
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [languageReady, setLanguageReady] = useState(false);
  const [auth, setAuth] = useState<AuthSessionResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [latestMeta, setLatestMeta] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authPending, setAuthPending] = useState(true);
  const [chatPending, setChatPending] = useState(false);
  const [replyPending, setReplyPending] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [playingMessageKey, setPlayingMessageKey] = useState<string | null>(null);
  const [loadingSpeechMessageKey, setLoadingSpeechMessageKey] = useState<string | null>(null);

  const chatTimelineRef = useRef<HTMLDivElement | null>(null);
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
  const chatStreamAbortRef = useRef<AbortController | null>(null);

  const languageMeta = LANGUAGE_META[language];
  const t = TRANSLATIONS[language];
  const translationRef = useRef(t);

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

    if (avatarSpeaking) {
      return "speaking";
    }

    if (chatPending) {
      return "thinking";
    }

    return "idle";
  }, [avatarSpeaking, chatPending, speechActive]);

  const speechButtonLabel = useMemo(() => {
    if (!speechSupported) {
      return t.speech.unsupported;
    }

    return speechActive ? t.speech.releaseToStop : t.speech.holdToTalk;
  }, [speechActive, speechSupported, t]);

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
      setError(getErrorMessage(requestError, translationRef.current.errors.sessionLoadFailed));
    } finally {
      setAuthPending(false);
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let savedLanguage: string | null = null;
    try {
      savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      savedLanguage = null;
    }

    const browserLanguages =
      window.navigator.languages?.length > 0
        ? window.navigator.languages
        : [window.navigator.language];
    const nextLanguage = isLanguage(savedLanguage)
      ? savedLanguage
      : resolveBrowserLanguage(browserLanguages.filter(Boolean));

    setLanguage(nextLanguage);
    setLanguageReady(true);
  }, []);

  useEffect(() => {
    translationRef.current = t;
  }, [t]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = languageMeta.htmlLang;
    }

    if (!languageReady || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore storage failures in private or restricted browser contexts.
    }
  }, [language, languageMeta.htmlLang, languageReady]);

  useEffect(() => {
    void refreshSession();
  }, []);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    const timeline = chatTimelineRef.current;
    if (!timeline) {
      return;
    }

    timeline.scrollTo({
      top: timeline.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, replyPending]);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = languageMeta.speechLocale;
    }
  }, [languageMeta.speechLocale]);

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
    recognition.lang = languageMeta.speechLocale;

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
        setError(translationRef.current.errors.microphonePermission);
        return;
      }

      setError(translationRef.current.errors.speechStartFailed);
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
      abortChatStream();
      stopTtsPlayback();
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

  function abortChatStream() {
    chatStreamAbortRef.current?.abort();
    chatStreamAbortRef.current = null;
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

  function stopTtsPlayback() {
    stopAssistantSpeaking();
    setPlayingMessageKey(null);
    setLoadingSpeechMessageKey(null);
  }

  async function handleTtsToggle(text: string, messageKey: string) {
    if (playingMessageKey === messageKey) {
      stopTtsPlayback();
      return;
    }

    stopTtsPlayback();
    setLoadingSpeechMessageKey(messageKey);

    try {
      await speakAssistantAnswer(text);
      setPlayingMessageKey(messageKey);
      setLoadingSpeechMessageKey(null);
    } catch {
      setLoadingSpeechMessageKey(null);
      startAssistantTextAnimation(text);
    }
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
      setPlayingMessageKey(null);
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
      setError(getErrorMessage(requestError, t.errors.loginFailed));
    } finally {
      setAuthPending(false);
    }
  }

  async function handleLogout() {
    setAuthPending(true);
    setError(null);

    try {
      abortChatStream();
      stopSpeechCapture();
      stopTtsPlayback();
      await requestJson("/api/auth/logout", { method: "POST" });
      setAuth(unauthenticatedSession());
      setMessages([]);
      setLatestMeta(null);
      setPrompt("");
    } catch (requestError) {
      setError(getErrorMessage(requestError, t.errors.logoutFailed));
    } finally {
      setAuthPending(false);
    }
  }

  async function handleReset() {
    setChatPending(true);
    setError(null);

    try {
      abortChatStream();
      stopSpeechCapture();
      stopTtsPlayback();
      const history = await requestJson<ChatHistoryResponse>("/api/ai/history", {
        method: "DELETE",
      });
      setMessages(history?.messages ?? []);
      setLatestMeta(null);
      setPrompt("");
    } catch (requestError) {
      setError(getErrorMessage(requestError, t.errors.clearHistoryFailed));
    } finally {
      setChatPending(false);
    }
  }

  async function submitPrompt(nextPrompt: string) {
    const normalizedPrompt = nextPrompt.trim();
    if (!auth?.authenticated || normalizedPrompt.length === 0 || chatPending) {
      return;
    }

    abortChatStream();
    setChatPending(true);
    setReplyPending(true);
    setError(null);
    stopTtsPlayback();

    const userCreatedAt = new Date().toISOString();
    const assistantCreatedAt = new Date().toISOString();
    const optimisticMessage: ChatMessage = {
      role: "user",
      content: normalizedPrompt,
      createdAt: userCreatedAt,
    };
    const streamingAssistantMessage: ChatMessage = {
      role: "assistant",
      content: "",
      createdAt: assistantCreatedAt,
    };
    const abortController = new AbortController();

    chatStreamAbortRef.current = abortController;
    setMessages((currentMessages) => [
      ...currentMessages,
      optimisticMessage,
      streamingAssistantMessage,
    ]);
    setPrompt("");
    promptRef.current = "";
    speechBasePromptRef.current = "";

    try {
      const response = await fetch(`${apiBaseUrl}/api/ai/chat/stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: normalizedPrompt,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(await readFetchError(response));
      }

      if (!response.body) {
        throw new Error(t.errors.sendFailed);
      }

      let receivedDelta = false;
      const streamResult: {
        finalResponse: ChatResponse | null;
        streamError: Error | null;
      } = {
        finalResponse: null,
        streamError: null,
      };

      await readSseStream(response.body, (event) => {
        if (event.event === "delta") {
          const payload = parseSseJson<ChatStreamDelta>(event);
          const text = payload?.text ?? "";
          if (!text) {
            return;
          }

          if (!receivedDelta) {
            receivedDelta = true;
            setReplyPending(false);
          }

          setMessages((currentMessages) =>
            appendAssistantDelta(currentMessages, assistantCreatedAt, text),
          );
          return;
        }

        if (event.event === "done") {
          streamResult.finalResponse = parseSseJson<ChatResponse>(event);
          return;
        }

        if (event.event === "error") {
          const payload = parseSseJson<ChatStreamError>(event);
          streamResult.streamError = new Error(payload?.message ?? t.errors.sendFailed);
        }
      });

      if (streamResult.streamError) {
        throw streamResult.streamError;
      }

      if (!streamResult.finalResponse) {
        throw new Error(t.errors.sendFailed);
      }

      const finalResponse = streamResult.finalResponse;
      setMessages(finalResponse.history);
      setLatestMeta(finalResponse);
    } catch (requestError) {
      if (abortController.signal.aborted) {
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.filter(
          (message) =>
            !(
              (message.role === "user" && message.createdAt === userCreatedAt) ||
              (message.role === "assistant" && message.createdAt === assistantCreatedAt)
            ),
        ),
      );
      setPrompt(normalizedPrompt);
      promptRef.current = normalizedPrompt;
      speechBasePromptRef.current = normalizedPrompt;
      setError(getErrorMessage(requestError, t.errors.sendFailed));
    } finally {
      if (chatStreamAbortRef.current === abortController) {
        chatStreamAbortRef.current = null;
        setReplyPending(false);
        setChatPending(false);
      }
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

  function handleLanguageChange(nextLanguage: Language) {
    if (nextLanguage === language) {
      return;
    }

    if (speechActive) {
      stopSpeechCapture();
    }

    speechKeyHoldRef.current = false;
    setError(null);
    setLanguage(nextLanguage);
  }

  function startSpeechCapture() {
    if (!speechSupported || !auth?.authenticated || chatPending || speechActive) {
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      setError(t.errors.speechUnavailable);
      return;
    }

    speechBasePromptRef.current = promptRef.current.trim();
    speechHeardInputRef.current = false;
    setError(null);
    stopAssistantSpeaking();

    try {
      recognition.start();
    } catch {
      setError(t.errors.speechAlreadyRunning);
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
    <div className={`${styles.page} ${isAuthenticated ? styles.pageChat : ""}`}>
      <main className={`${styles.shell} ${isAuthenticated ? styles.shellChat : ""}`}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.brandLockup}>
              <div className={styles.brandLogo}>
                <Image alt={t.brand.logoAlt} priority sizes="88px" src={logoImage} />
              </div>
              <div className={styles.brandText}>
                <h1>Gorilla</h1>
                {auth?.authenticated ? (
                  <p className={styles.subtle}>{`${auth.username} · ${auth.role}`}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.topbarActions}>
            <div className={styles.languageToggle} role="group" aria-label={t.language.toggleLabel}>
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  aria-pressed={language === option.value}
                  className={`${styles.languageOption} ${
                    language === option.value ? styles.languageOptionActive : ""
                  }`}
                  key={option.value}
                  onClick={() => handleLanguageChange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            {auth?.authenticated ? (
              <>
                {latestMeta?.model ? (
                  <span className={styles.infoChip}>{t.status.model(latestMeta.model)}</span>
                ) : null}
                <span className={styles.infoChipMuted}>{t.status.messageCount(messages.length)}</span>
                <button
                  className={styles.secondaryButton}
                  disabled={chatPending}
                  onClick={handleReset}
                  type="button"
                >
                  {t.topbar.clearChat}
                </button>
                <button
                  className={styles.ghostButton}
                  disabled={authPending}
                  onClick={handleLogout}
                  type="button"
                >
                  {t.topbar.logout}
                </button>
              </>
            ) : null}
          </div>
        </header>

        <section className={`${styles.mainContent} ${isAuthenticated ? styles.mainContentChat : ""}`}>
          <div className={styles.errorSlot}>{error ? <p className={styles.errorBanner}>{error}</p> : null}</div>

          {auth?.authenticated ? (
            <section className={`${styles.workspace} ${styles.workspaceCompact}`}>
              <section className={`${styles.card} ${styles.chatPanel}`}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelText}>
                    <p className={styles.panelEyebrow}>{t.chat.eyebrow}</p>
                    <h2>{t.chat.title}</h2>
                  </div>
                </div>

                <section className={styles.chatArea}>
                  <div className={styles.chatTimeline} ref={chatTimelineRef}>
                    {messages.length === 0 && !replyPending ? (
                      <div className={styles.emptyState}>{t.chat.emptyState}</div>
                    ) : (
                      <>
                        {messages.map((message, index) => {
                          const messageKey = `${message.createdAt ?? "message"}-${message.role}-${index}`;
                          const isPlaying = playingMessageKey === messageKey;
                          const isLoading = loadingSpeechMessageKey === messageKey;
                          const canPlayTts =
                            message.role === "assistant" &&
                            message.content.length > 0 &&
                            !replyPending &&
                            !chatPending;

                          return (
                            <article
                              className={
                                message.role === "user" ? styles.userMessage : styles.gorillaMessage
                              }
                              key={messageKey}
                            >
                              <div className={styles.messageMeta}>
                                <span>
                                  {message.role === "user" ? t.chat.userRole : t.chat.assistantRole}
                                </span>
                                <time>{formatTimestamp(message.createdAt, language)}</time>
                              </div>
                              {message.role === "assistant" &&
                              message.content.length === 0 &&
                              replyPending ? (
                                <div
                                  aria-live="polite"
                                  className={styles.typingBubble}
                                  role="status"
                                >
                                  <span className={styles.srOnly}>{t.chat.assistantThinking}</span>
                                  <span className={styles.typingDot} />
                                  <span className={`${styles.typingDot} ${styles.typingDotSecond}`} />
                                  <span className={`${styles.typingDot} ${styles.typingDotThird}`} />
                                </div>
                              ) : (
                                <p>{message.content}</p>
                              )}
                              {canPlayTts ? (
                                <div className={styles.messageActions}>
                                  <button
                                    aria-label={
                                      isLoading
                                        ? t.tts.loadingAria
                                        : isPlaying
                                          ? t.tts.stopAria
                                          : t.tts.listenAria
                                    }
                                    className={`${styles.ttsButton} ${
                                      isPlaying ? styles.ttsButtonPlaying : ""
                                    } ${isLoading ? styles.ttsButtonLoading : ""}`}
                                    disabled={isLoading}
                                    onClick={() => handleTtsToggle(message.content, messageKey)}
                                    type="button"
                                  >
                                    <svg
                                      aria-hidden="true"
                                      className={styles.ttsIcon}
                                      fill="none"
                                      height="18"
                                      viewBox="0 0 24 24"
                                      width="18"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      {isPlaying ? (
                                        <rect fill="currentColor" height="14" rx="2" width="4" x="6" y="5" />
                                      ) : null}
                                      {isPlaying ? (
                                        <rect fill="currentColor" height="14" rx="2" width="4" x="14" y="5" />
                                      ) : null}
                                      {!isPlaying ? (
                                        <path
                                          d="M3 9v6h4l5 5V4L7 9H3z"
                                          fill="currentColor"
                                        />
                                      ) : null}
                                      {!isPlaying ? (
                                        <path
                                          d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"
                                          fill="currentColor"
                                        />
                                      ) : null}
                                      {!isPlaying ? (
                                        <path
                                          d="M19.07 4.93a10 10 0 010 14.14M16.54 7.46a6 6 0 010 9.08"
                                          stroke="currentColor"
                                          strokeLinecap="round"
                                          strokeWidth="1.5"
                                        />
                                      ) : null}
                                    </svg>
                                    <span>
                                      {isLoading
                                        ? t.tts.loading
                                        : isPlaying
                                          ? t.tts.stop
                                          : t.tts.listen}
                                    </span>
                                    {isLoading ? <span className={styles.ttsSpinner} /> : null}
                                  </button>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}

                        {replyPending &&
                        !messages.some(
                          (message) => message.role === "assistant" && message.content.length === 0,
                        ) ? (
                          <article className={`${styles.gorillaMessage} ${styles.typingMessage}`}>
                            <div className={styles.messageMeta}>
                              <span>{t.chat.assistantRole}</span>
                              <time>{t.timestamp.justNow}</time>
                            </div>
                            <div
                              aria-live="polite"
                              className={styles.typingBubble}
                              role="status"
                            >
                              <span className={styles.srOnly}>{t.chat.assistantThinking}</span>
                              <span className={styles.typingDot} />
                              <span className={`${styles.typingDot} ${styles.typingDotSecond}`} />
                              <span className={`${styles.typingDot} ${styles.typingDotThird}`} />
                            </div>
                          </article>
                        ) : null}
                      </>
                    )}
                  </div>
                </section>

                <form className={styles.composer} onSubmit={handleSend}>
                  <textarea
                    className={styles.promptInput}
                    disabled={chatPending}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder={t.chat.promptPlaceholder}
                    rows={4}
                    value={prompt}
                  />

                  <div className={styles.composerFooter}>
                    <button
                      aria-label={speechActive ? t.speech.stopAria : t.speech.startAria}
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
                        {t.chat.clearPrompt}
                      </button>
                      <button className={styles.primaryButton} disabled={!canSend} type="submit">
                        {chatPending ? t.chat.sending : t.chat.send}
                      </button>
                    </div>
                  </div>
                </form>
              </section>

              <aside className={`${styles.card} ${styles.avatarPanel}`}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelText}>
                    <p className={styles.panelEyebrow}>{t.avatar.eyebrow}</p>
                    <h2>{t.avatar.title}</h2>
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
                  <p className={styles.panelEyebrow}>{t.login.eyebrow}</p>
                  <h2 className={styles.loginTitle}>{t.login.title}</h2>
                </div>

                <form className={styles.loginForm} onSubmit={handleLogin}>
                  <label className={styles.field}>
                    <span>{t.login.username}</span>
                    <input
                      autoComplete="username"
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="admin"
                      value={username}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>{t.login.password}</span>
                    <input
                      autoComplete="current-password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={t.login.passwordPlaceholder}
                      type="password"
                      value={password}
                    />
                  </label>
                  <button className={styles.primaryButton} disabled={authPending} type="submit">
                    {authPending ? t.login.submitting : t.login.submit}
                  </button>
                </form>
              </div>

              <aside className={`${styles.card} ${styles.loginPreview}`}>
                <div className={styles.panelText}>
                  <p className={styles.panelEyebrow}>{t.login.previewEyebrow}</p>
                  <h2>{t.login.previewTitle}</h2>
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

async function readFetchError(response: Response) {
  const rawError = await response.text().catch(() => "");
  if (!rawError) {
    return `Request failed with status ${response.status}`;
  }

  try {
    const payload = JSON.parse(rawError) as Record<string, unknown>;
    return typeof payload.message === "string"
      ? payload.message
      : typeof payload.error === "string"
        ? payload.error
        : rawError;
  } catch {
    return rawError;
  }
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");

      let boundaryIndex = buffer.indexOf("\n\n");
      while (boundaryIndex >= 0) {
        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);
        const event = parseSseEvent(rawEvent);
        if (event) {
          onEvent(event);
        }
        boundaryIndex = buffer.indexOf("\n\n");
      }

      if (done) {
        break;
      }
    }

    const finalEvent = parseSseEvent(buffer);
    if (finalEvent) {
      onEvent(finalEvent);
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseEvent(rawEvent: string): ChatStreamEvent | null {
  if (!rawEvent.trim()) {
    return null;
  }

  let eventName: string | null = null;
  const dataLines: string[] = [];

  for (const rawLine of rawEvent.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    let value = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : "";
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    if (field === "event") {
      eventName = value || null;
    }

    if (field === "data") {
      dataLines.push(value);
    }
  }

  if (!eventName && dataLines.length === 0) {
    return null;
  }

  return {
    event: eventName,
    data: dataLines.length > 0 ? dataLines.join("\n") : null,
  };
}

function parseSseJson<T>(event: ChatStreamEvent): T | null {
  if (!event.data) {
    return null;
  }

  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

function appendAssistantDelta(
  messages: ChatMessage[],
  assistantCreatedAt: string,
  text: string,
) {
  let targetIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant" && message.createdAt === assistantCreatedAt) {
      targetIndex = index;
      break;
    }
  }

  if (targetIndex < 0) {
    return [
      ...messages,
      {
        role: "assistant" as const,
        content: text,
        createdAt: assistantCreatedAt,
      },
    ];
  }

  return messages.map((message, index) =>
    index === targetIndex ? { ...message, content: `${message.content}${text}` } : message,
  );
}

function formatTimestamp(value: string | null, language: Language) {
  const fallback = TRANSLATIONS[language].timestamp.justNow;

  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(LANGUAGE_META[language].dateLocale, {
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

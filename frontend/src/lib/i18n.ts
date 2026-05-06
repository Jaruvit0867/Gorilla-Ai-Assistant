export type Language = "th" | "en";

export type TranslationBundle = {
  brand: {
    logoAlt: string;
  };
  language: {
    toggleLabel: string;
  };
  status: {
    model: (model: string) => string;
    messageCount: (count: number) => string;
  };
  topbar: {
    clearChat: string;
    logout: string;
  };
  chat: {
    eyebrow: string;
    title: string;
    emptyState: string;
    userRole: string;
    assistantRole: string;
    assistantThinking: string;
    promptPlaceholder: string;
    clearPrompt: string;
    send: string;
    sending: string;
  };
  speech: {
    unsupported: string;
    holdToTalk: string;
    releaseToStop: string;
    startAria: string;
    stopAria: string;
  };
  tts: {
    listen: string;
    loading: string;
    stop: string;
    listenAria: string;
    loadingAria: string;
    stopAria: string;
  };
  avatar: {
    eyebrow: string;
    title: string;
  };
  login: {
    eyebrow: string;
    title: string;
    username: string;
    password: string;
    passwordPlaceholder: string;
    submit: string;
    submitting: string;
    previewEyebrow: string;
    previewTitle: string;
  };
  timestamp: {
    justNow: string;
  };
  errors: {
    sessionLoadFailed: string;
    microphonePermission: string;
    speechStartFailed: string;
    loginFailed: string;
    logoutFailed: string;
    clearHistoryFailed: string;
    sendFailed: string;
    speechUnavailable: string;
    speechAlreadyRunning: string;
  };
};

export const DEFAULT_LANGUAGE: Language = "th";

export const LANGUAGE_STORAGE_KEY = "gorilla.language";

export const LANGUAGE_OPTIONS = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "EN" },
] as const satisfies ReadonlyArray<{ value: Language; label: string }>;

export const LANGUAGE_META = {
  th: {
    htmlLang: "th",
    speechLocale: "th-TH",
    dateLocale: "th-TH",
  },
  en: {
    htmlLang: "en",
    speechLocale: "en-US",
    dateLocale: "en-US",
  },
} as const satisfies Record<
  Language,
  {
    htmlLang: string;
    speechLocale: string;
    dateLocale: string;
  }
>;

export const TRANSLATIONS = {
  th: {
    brand: {
      logoAlt: "โลโก้ Gorilla",
    },
    language: {
      toggleLabel: "เลือกภาษา",
    },
    status: {
      model: (model) => `โมเดล ${model}`,
      messageCount: (count) => `${count} ข้อความ`,
    },
    topbar: {
      clearChat: "ล้างแชต",
      logout: "ออกจากระบบ",
    },
    chat: {
      eyebrow: "แชต",
      title: "แชตกับ Gorilla",
      emptyState: "พิมพ์ข้อความหรือกดเพื่อเริ่มพูด",
      userRole: "คุณ",
      assistantRole: "Gorilla",
      assistantThinking: "Gorilla กำลังคิดคำตอบ",
      promptPlaceholder: "พิมพ์ข้อความหรือกดเพื่อเริ่มพูด...",
      clearPrompt: "ล้างข้อความ",
      send: "ส่งข้อความ",
      sending: "กำลังส่ง...",
    },
    speech: {
      unsupported: "ไม่รองรับการพูด",
      holdToTalk: "กดค้างเพื่อพูด",
      releaseToStop: "ปล่อยเพื่อหยุด",
      startAria: "กดค้างเพื่อเริ่มแปลงเสียงเป็นข้อความ",
      stopAria: "ปล่อยเพื่อหยุดแปลงเสียงเป็นข้อความ",
    },
    tts: {
      listen: "ฟังคำตอบ",
      loading: "กำลังโหลดเสียง",
      stop: "หยุดเสียง",
      listenAria: "ฟังคำตอบเป็นเสียง",
      loadingAria: "กำลังโหลดเสียง",
      stopAria: "หยุดเสียง",
    },
    avatar: {
      eyebrow: "อวาตาร์",
      title: "Gorilla",
    },
    login: {
      eyebrow: "เข้าสู่ระบบผู้ดูแล",
      title: "เข้าสู่ระบบ",
      username: "ชื่อผู้ใช้",
      password: "รหัสผ่าน",
      passwordPlaceholder: "กรอกรหัสผ่าน",
      submit: "เข้าสู่ระบบ",
      submitting: "กำลังเข้าสู่ระบบ...",
      previewEyebrow: "ตัวอย่าง",
      previewTitle: "อวาตาร์ Gorilla",
    },
    timestamp: {
      justNow: "เมื่อสักครู่",
    },
    errors: {
      sessionLoadFailed: "โหลดสถานะ session ไม่สำเร็จ",
      microphonePermission: "เบราว์เซอร์ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน",
      speechStartFailed: "เริ่มรับเสียงไม่สำเร็จ ลองใหม่อีกครั้ง",
      loginFailed: "ล็อกอินไม่สำเร็จ",
      logoutFailed: "ออกจากระบบไม่สำเร็จ",
      clearHistoryFailed: "ล้างประวัติแชตไม่สำเร็จ",
      sendFailed: "ส่งข้อความไม่สำเร็จ",
      speechUnavailable: "ตัวรับเสียงยังไม่พร้อมใช้งาน",
      speechAlreadyRunning: "ระบบรับเสียงกำลังทำงาน ลองใหม่อีกครั้ง",
    },
  },
  en: {
    brand: {
      logoAlt: "Gorilla logo",
    },
    language: {
      toggleLabel: "Select language",
    },
    status: {
      model: (model) => `Model ${model}`,
      messageCount: (count) => `${count} ${count === 1 ? "message" : "messages"}`,
    },
    topbar: {
      clearChat: "Clear chat",
      logout: "Log out",
    },
    chat: {
      eyebrow: "Chat",
      title: "Chat with Gorilla",
      emptyState: "Type a message or hold the mic to start speaking",
      userRole: "You",
      assistantRole: "Gorilla",
      assistantThinking: "Gorilla is thinking",
      promptPlaceholder: "Type a message or hold the mic to start speaking...",
      clearPrompt: "Clear",
      send: "Send",
      sending: "Sending...",
    },
    speech: {
      unsupported: "Speech unavailable",
      holdToTalk: "Hold to talk",
      releaseToStop: "Release to stop",
      startAria: "Hold to start speech to text",
      stopAria: "Release to stop speech to text",
    },
    tts: {
      listen: "Listen",
      loading: "Loading audio",
      stop: "Stop audio",
      listenAria: "Listen to the answer as audio",
      loadingAria: "Loading audio",
      stopAria: "Stop audio playback",
    },
    avatar: {
      eyebrow: "Avatar",
      title: "Gorilla",
    },
    login: {
      eyebrow: "Admin Login",
      title: "Log in",
      username: "Username",
      password: "Password",
      passwordPlaceholder: "Enter password (For live demo use: nottgorilla)",
      submit: "Log in",
      submitting: "Logging in...",
      previewEyebrow: "Preview",
      previewTitle: "Gorilla Avatar",
    },
    timestamp: {
      justNow: "Just now",
    },
    errors: {
      sessionLoadFailed: "Could not load session status",
      microphonePermission: "Browser microphone permission is not allowed",
      speechStartFailed: "Could not start speech input. Try again.",
      loginFailed: "Could not log in",
      logoutFailed: "Could not log out",
      clearHistoryFailed: "Could not clear chat history",
      sendFailed: "Could not send message",
      speechUnavailable: "Speech input is not ready yet",
      speechAlreadyRunning: "Speech input is already running. Try again.",
    },
  },
} satisfies Record<Language, TranslationBundle>;

export function isLanguage(value: string | null | undefined): value is Language {
  return value === "th" || value === "en";
}

export function resolveBrowserLanguage(languages: readonly string[]): Language {
  return languages.some((language) => language.toLowerCase().startsWith("th"))
    ? "th"
    : "en";
}

"use client";

import { useEffect } from "react";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export default function ScrollController() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let hoveredIndex = -1;

    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-story-card]"));

    const update = () => {
      frame = 0;
      const maxScroll = Math.max(root.scrollHeight - window.innerHeight, 1);
      const pageProgress = clamp(window.scrollY / maxScroll);
      const story = document.getElementById("story-flow");
      let storyProgress = 0;

      if (story) {
        const rect = story.getBoundingClientRect();
        const travel = Math.max(rect.height - window.innerHeight * 0.35, 1);
        storyProgress = clamp((window.innerHeight * 0.64 - rect.top) / travel);
      }

      /* ── Hero parallax ── */
      const heroFade = clamp(1 - window.scrollY / (window.innerHeight * 0.55));
      const heroShift = window.scrollY * 0.25;
      root.style.setProperty("--hero-opacity", heroFade.toFixed(4));
      root.style.setProperty("--hero-shift", `${-heroShift}px`);

      /* ── Background & decorative vars ── */
      root.style.setProperty("--scroll-progress", pageProgress.toFixed(4));
      root.style.setProperty("--story-progress", storyProgress.toFixed(4));
      root.style.setProperty("--wave-y", `${pageProgress * -96}px`);
      root.style.setProperty("--wave-scale", `${1 + pageProgress * 0.16}`);
      root.style.setProperty("--story-x", `${storyProgress * 70}%`);
      root.style.setProperty("--story-y", `${storyProgress * 22}%`);
      root.style.setProperty("--drift-a-x", `${pageProgress * -92}px`);
      root.style.setProperty("--drift-a-y", `${pageProgress * 68}px`);
      root.style.setProperty("--drift-a-r", `${pageProgress * -12}deg`);
      root.style.setProperty("--drift-b-x", `${pageProgress * 84}px`);
      root.style.setProperty("--drift-b-y", `${pageProgress * 48}px`);
      root.style.setProperty("--drift-b-r", `${pageProgress * 10}deg`);
      root.style.setProperty("--drift-c-x", `${pageProgress * -64}px`);
      root.style.setProperty("--drift-c-y", `${pageProgress * -76}px`);
      root.style.setProperty("--drift-c-r", `${pageProgress * 9}deg`);

      /* ── Section intro & Layout reveal ── */
      const sectionIntro = document.querySelector<HTMLElement>(".sectionIntro");
      if (sectionIntro) {
        const introRect = sectionIntro.getBoundingClientRect();
        sectionIntro.classList.toggle("isRevealed", introRect.top < window.innerHeight * 0.82);
      }

      const storyLayout = document.querySelector<HTMLElement>(".storyLayout");
      if (storyLayout) {
        const layoutRect = storyLayout.getBoundingClientRect();
        storyLayout.classList.toggle("isRevealed", layoutRect.top < window.innerHeight * 0.85);
      }

      /* ── Story cards & chat activation (Hover Only) ── */
      const messages = Array.from(
        document.querySelectorAll<HTMLElement>("[data-chat-message]"),
      );

      const finalActiveIndex = hoveredIndex; // Only use hover, no more scroll activation
      
      // Auto-play trigger for chat
      const chatThread = document.querySelector<HTMLElement>(".chatThread");
      if (storyLayout && storyLayout.classList.contains("isRevealed")) {
        chatThread?.classList.add("isPlaying");
      } else {
        chatThread?.classList.remove("isPlaying");
      }

      for (const [index, card] of cards.entries()) {
        card.classList.toggle("isActive", index === finalActiveIndex);
      }

      root.classList.toggle("ttsActive", finalActiveIndex === 2);

      for (const message of messages) {
        // Highlighting logic based on hovered card:
        // finalActiveIndex 0 -> Highlight Employee questions
        // finalActiveIndex 1 -> Highlight Assistant answers
        // finalActiveIndex 2 -> Highlight Assistant answers & show TTS wave
        const isEmployee = message.classList.contains("employee");
        const isAssistant = message.classList.contains("assistant");
        
        const isHighlighted = 
          (finalActiveIndex === 0 && isEmployee) || 
          (finalActiveIndex === 1 && isAssistant) || 
          (finalActiveIndex === 2 && isAssistant);

        // Dim messages that are not highlighted when hovering over a card
        message.classList.toggle("isDimmed", finalActiveIndex !== -1 && !isHighlighted);
        message.classList.toggle("isHighlighted", isHighlighted);
        
        message.classList.toggle(
          "isSpeaking",
          isAssistant && finalActiveIndex === 2
        );
      }
    };

    const requestUpdate = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(update);
    };

    // Attach hover listeners to cards
    const enterListeners = cards.map((_, index) => () => {
      hoveredIndex = index;
      requestUpdate();
    });

    const leaveListeners = cards.map(() => () => {
      hoveredIndex = -1;
      requestUpdate();
    });

    for (const [index, card] of cards.entries()) {
      card.addEventListener("mouseenter", enterListeners[index]);
      card.addEventListener("mouseleave", leaveListeners[index]);
    }

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      
      for (const [index, card] of cards.entries()) {
        card.removeEventListener("mouseenter", enterListeners[index]);
        card.removeEventListener("mouseleave", leaveListeners[index]);
      }
      
      root.classList.remove("ttsActive");
    };
  }, []);

  return null;
}

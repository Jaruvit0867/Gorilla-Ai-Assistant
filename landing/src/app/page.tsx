import Image from "next/image";
import type { CSSProperties } from "react";
import ScrollController from "../components/scroll-controller";

const githubUrl = "https://github.com/Jaruvit0867/Gorilla-Ai-Assistant/tree/avatar";
const demoUrl = "https://witty-plant-0d96a2700.7.azurestaticapps.net/";
const portfolioUrl = "https://jaruvit0867.github.io/";

const featurePills = [
  "Voice-activated AI",
  "Instant recipe instructions",
  "No more reading manuals",
  "Hands-free kitchen workflow",
];

const menuChips = [
  { label: "Ingredients?", className: "chipOne" },
  { label: "Banoffee Bowl", className: "chipTwo" },
  { label: "Allergens?", className: "chipThree" },
  { label: "Best seller", className: "chipFour" },
  { label: "Prep notes", className: "chipFive" },
  { label: "Price check", className: "chipSix" },
];

const storySteps = [
  {
    number: "01",
    eyebrow: "The Problem",
    title: "Searching docs takes too much time.",
    body: "Searching through recipe papers attached to the wall or reading training manuals takes too much time in a busy kitchen.",
    icon: "lock",
  },
  {
    number: "02",
    eyebrow: "The Solution",
    title: "AI Assistant.",
    body: "Staff can simply ask the AI directly to get instant recipe instructions. The assistant uses RAG via Azure AI Foundry to accurately retrieve answers from your actual documents.",
    icon: "spark",
  },
  {
    number: "03",
    eyebrow: "The Result",
    title: "Voice-activated & Hands-free.",
    body: "The AI reads answers out loud. This voice-activated capability allows team members to hear quick instructions and continue their prep work without ever needing to use their hands or look at a screen.",
    icon: "speaker",
  },
];

const chatMessages = [
  {
    id: 1,
    role: "employee",
    text: "How do I make the Banoffee Bowl?",
  },
  {
    id: 2,
    role: "assistant",
    text: "Banana, caramel, cream, biscuit crumb, and coffee topping.",
  },
  {
    id: 3,
    role: "employee",
    text: "Is there any gluten in it?",
  },
  {
    id: 4,
    role: "assistant",
    text: "Yes, the biscuit crumb contains gluten.",
  },
  {
    id: 5,
    role: "employee",
    text: "What's the price?",
  },
  {
    id: 6,
    role: "assistant",
    text: "It is $8.50.",
  },
  {
    id: 7,
    role: "employee",
    text: "How long to prepare?",
  },
  {
    id: 8,
    role: "assistant ttsTarget",
    text: "It takes about 5 minutes to prep.",
  },
];

const stack = ["Next.js", "Spring Boot", "Azure AI", "Azure Speech"];

export default function Home() {
  return (
    <main className="pageShell">
      <ScrollController />

      <div className="backgroundLayer" aria-hidden="true">
        <div className="gridTexture" />
        <div className="waveField">
          {Array.from({ length: 42 }, (_, index) => (
            <span key={index} style={{ "--i": index } as CSSProperties} />
          ))}
        </div>
        <div className="menuOrbit" />
        <div className="pulseRing pulseRingOne" />
        <div className="pulseRing pulseRingTwo" />
        <div className="pulseRing pulseRingThree" />
        {menuChips.map((chip) => (
          <div className={`floatingChip ${chip.className}`} key={chip.label}>
            {chip.label}
          </div>
        ))}
      </div>

      <header className="topbar">
        <a className="brand" href={portfolioUrl} target="_blank" rel="noreferrer">
          <span className="brandMark">
            <Image src="/logo.png" alt="" width={36} height={36} priority />
          </span>
          <span>Gorilla</span>
        </a>

        <nav className="navActions" aria-label="Primary navigation">
          <span className="statusPill">
            <span />
            Online
          </span>
          <a className="ghostButton" href={githubUrl} target="_blank" rel="noreferrer">
            <GithubIcon />
            Github
          </a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="heroBadge">
          <span />
          AI For Busy Kitchens
        </div>

        <h1 id="hero-title">Gorilla AI Cafe Assistant</h1>
        <p className="heroCopy">
          Searching through recipe papers attached to the wall or reading training manuals takes too much time. Gorilla is a voice-activated assistant built to give staff instant recipe instructions.
        </p>

        <div className="featurePills" aria-label="Key features">
          {featurePills.map((feature) => (
            <span key={feature}>{feature}</span>
          ))}
        </div>

        <div className="heroActions">
          <a className="primaryButton" href={demoUrl} target="_blank" rel="noreferrer">
            <PlayIcon />
            Live Demo
          </a>
          <a className="secondaryButton" href="#story-flow">
            <ArrowDownIcon />
            How it works
          </a>
        </div>

        <a className="scrollCue" href="#story-flow" aria-label="Scroll to the product flow">
          <span />
        </a>
      </section>

      <section className="storySection" id="story-flow" aria-labelledby="story-title">
        <div className="sectionIntro">
          <span className="sectionKicker">How it works</span>
          <h2 id="story-title">From manual to instant answers.</h2>
          <p>
            See how the Gorilla Assistant transforms a slow, paper-based workflow into a rapid voice-activated interaction.
          </p>
        </div>

        <div className="storyLayout">
          <div className="storyVisual" aria-hidden="true">
            <div className="assistantPanel">
              <div className="assistantTopline">
                <span />
                Employee support flow
              </div>
              <div className="assistantHeader">
                <div className="assistantAvatar">
                  <Image src="/logo.png" alt="" width={56} height={56} />
                </div>
                <div>
                  <strong>Gorilla Assistant</strong>
                  <span>Menu knowledge for staff</span>
                </div>
              </div>
              <div className="chatThread">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chatBubble ${msg.role}`}
                  data-chat-message
                >
                  <p>{msg.text}</p>
                  {msg.role.includes("ttsTarget") && (
                    <span className="ttsWave" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </div>
              ))}
            </div>
            </div>
          </div>

          <div className="storyTrack">
            {storySteps.map((step) => (
              <article className="storyCard" data-story-card key={step.number}>
                <span className="storyNumber">{step.number}</span>
                <span className="storyIcon" aria-hidden="true">
                  <StepIcon name={step.icon} />
                </span>
                <p className="storyEyebrow">{step.eyebrow}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="bottomBar">
        <a className="footerBrand" href={portfolioUrl} target="_blank" rel="noreferrer">
          <span className="footerLogo">
            <img src="/logo.png" alt="" width={16} height={16} style={{ objectFit: "contain" }} />
          </span>
          Gorilla
        </a>
        <div className="stackChips" aria-label="Technology stack">
          <span>Built with</span>
          {stack.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <p className="privacyNote">
          <ShieldIcon />
          Session-based context with protected backend APIs
        </p>
      </footer>
    </main>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.36-1.18-3.36-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.04 1.53 1.04.9 1.52 2.35 1.08 2.92.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.4 9.4 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.56 4.93.36.31.68.92.68 1.86v2.76c0 .26.18.57.69.48A10 10 0 0 0 12 2.2Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.2v13.6l10.8-6.8L8 5.2Z" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.5a1 1 0 0 1 1 1v10.09l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V5.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8 5.4 5.3v5.1c0 4.35 2.72 8.26 6.6 9.78 3.88-1.52 6.6-5.43 6.6-9.78V5.3L12 2.8Zm0 2.14 4.6 1.74v3.72c0 3.19-1.78 6.15-4.6 7.6-2.82-1.45-4.6-4.41-4.6-7.6V6.68L12 4.94Z" />
    </svg>
  );
}

function StepIcon({ name }: { name: string }) {
  if (name === "lock") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M7 10V8.2a5 5 0 0 1 10 0V10h1.2A1.8 1.8 0 0 1 20 11.8v7.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 19.2v-7.4A1.8 1.8 0 0 1 5.8 10H7Zm2 0h6V8.2a3 3 0 0 0-6 0V10Zm3 3.1a1.4 1.4 0 0 0-.7 2.61V18h1.4v-2.29a1.4 1.4 0 0 0-.7-2.61Z" />
      </svg>
    );
  }

  if (name === "wave") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M4 14a1 1 0 0 1-1-1v-2a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1Zm4 3a1 1 0 0 1-1-1V8a1 1 0 1 1 2 0v8a1 1 0 0 1-1 1Zm4 3a1 1 0 0 1-1-1V5a1 1 0 1 1 2 0v14a1 1 0 0 1-1 1Zm4-3a1 1 0 0 1-1-1V8a1 1 0 1 1 2 0v8a1 1 0 0 1-1 1Zm4-3a1 1 0 0 1-1-1v-2a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1Z" />
      </svg>
    );
  }

  if (name === "spark") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M12 2.8a1 1 0 0 1 .92.62l1.96 4.74 5.12 1.02a1 1 0 0 1 .32 1.82l-4.1 2.88.6 5.1a1 1 0 0 1-1.5.98L12 17.32l-3.32 2.64a1 1 0 0 1-1.5-.98l.6-5.1L3.68 11a1 1 0 0 1 .32-1.82l5.12-1.02 1.96-4.74A1 1 0 0 1 12 2.8Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24">
      <path d="M5 9.2h3.2l4.4-4.1A1.4 1.4 0 0 1 15 6.12v11.76a1.4 1.4 0 0 1-2.4 1.02l-4.4-4.1H5a1.8 1.8 0 0 1-1.8-1.8v-2A1.8 1.8 0 0 1 5 9.2Zm12.4.1a1 1 0 0 1 1.42 0 3.8 3.8 0 0 1 0 5.4 1 1 0 0 1-1.42-1.4 1.82 1.82 0 0 0 0-2.6 1 1 0 0 1 0-1.4Zm2.55-2.55a1 1 0 0 1 1.42 0 7.4 7.4 0 0 1 0 10.5 1 1 0 1 1-1.42-1.42 5.4 5.4 0 0 0 0-7.66 1 1 0 0 1 0-1.42Z" />
    </svg>
  );
}

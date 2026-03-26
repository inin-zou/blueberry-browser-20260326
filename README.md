# Blueberry Browser

An AI-native browser where the AI co-pilot is embedded in the browsing experience — not waiting to be asked, not taking over completely, but co-browsing with you in real time.

---

## Design Philosophy

**"A browser that treats every tab as a workspace, every interaction as a signal, and every page as data the AI can read, annotate, and act on."**

Blueberry is built on a 6-layer architecture inspired by next-generation AI browsers:

| Layer | What It Does |
|-------|-------------|
| Browser Shell | Tabs, address bar, navigation — the viewport |
| Agent Runtime | Attention engine, intent detection — the sensing layer |
| Page Interaction | rrweb capture, JS injection, DOM actions — the action layer |
| Native Bridge | Secure IPC with whitelisted channels — the safety layer |
| Data & Memory | SQLite persistence, browser history import — the knowledge layer |
| Trust & Safety | Progressive disclosure, approval gates, reversible actions — the trust layer |

### Key Principles

- **Privacy-first, local-first** — browsing data never leaves the device. Cloud is only used for deliberate user actions.
- **Progressive disclosure** — AI starts silent, escalates only with evidence of need, throttles after being ignored.
- **Dual-model architecture** — local model (Qwen 0.5B) for instant responses, cloud LLM for deep reasoning.
- **Event-sourced design** — every AI action is logged, debuggable, and reversible.
- **Tab as execution unit** — each tab has an event stream, attention profile, and context summary.

---

## Features

### Core AI Co-Pilot

- **Text Selection Pill** — Select any text on a page, a floating glass pill appears with "Explain" (inline tooltip) and "Ask AI" (sidebar deep dive)
- **Ghost Text Auto-Completion** — Copilot-style Tab completion in any text field on any webpage, context-aware of your other tabs and browsing history
- **AI Sidebar Chat with Browser Tools** — Chat with an AI that can take actions: click buttons, fill forms, navigate pages, run JavaScript, read page content

### Intelligent Sensing

- **Attention Engine** — Tracks mouse dwell, scroll velocity, scroll-back patterns, and tab switching to detect user intent (confused, comparing, interested)
- **Page Annotations** — Proactive highlights and notes on content you're dwelling on, with progressive disclosure (throttles after dismissals)
- **Cross-Tab Synthesis** — Detects when you're comparing tabs and generates structured comparison tables

### Page Understanding

- **Context-Aware Page Rewrite** — Classifies pages (article, docs, product, dashboard) and generates TL;DR + key points
- **Code Sandbox** — AI writes scripts to extract/transform page data, executes in isolated sandbox, shows results before applying

### Productivity

- **Browser History Import** — Import Chrome/Safari/Firefox history on first launch to personalize the AI from day one
- **Workflow Recorder** — Records browsing workflows via rrweb, shows step-by-step replay, saves for later
- **Local AI Model** — Qwen2.5-0.5B runs locally via WebGPU/WASM for instant Explain tooltips without API calls

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App Shell | Electron 37 + electron-vite |
| Renderer | React 19 + Tailwind CSS |
| State Management | React Context (existing) + Zustand (new features) |
| Local Database | sql.js (SQLite via WASM) |
| Cloud LLM | Vercel AI SDK + OpenAI / Anthropic (configurable) |
| Local Model | Qwen2.5-0.5B via @huggingface/transformers + ONNX Runtime |
| Session Recording | rrweb v2 |
| Testing | Vitest (134 unit tests) |

---

## Architecture

```
Electron App
  Main Process
    EventBus          — Central pub/sub for all events
    RrwebRingBuffer   — Capped in-memory event store
    AIEventLog        — Append-only log of all AI actions
    AttentionEngine   — Behavioral signal detection
    AnnotationManager — Progressive disclosure annotations
    CompletionEngine  — Ghost text completions
    TabSynthesizer    — Cross-tab comparison
    PageRewriter      — Page type detection + summarization
    SandboxManager    — Isolated script execution
    WorkflowRecorder  — Action log from rrweb events
    LocalModelManager — Qwen2.5-0.5B runtime
    ModelRouter       — Routes between local and cloud models
    BrowserTools      — Click, type, navigate, scroll, read
    StorageBackend    — SQLite persistence (Supabase-ready interface)

  Tab Views (per tab)
    Preload IPC bridge (whitelisted channels)
    Injected scripts:
      rrweb-capture     — Behavioral data collection
      selection-pill    — Text selection floating pill
      ghost-text        — Auto-completion overlay
      page-annotations  — AI highlights and notes
      page-rewriter     — TL;DR overlay bar

  Sidebar (React)
    Chat + Browser Tools
    Synthesis View
    Sandbox Results
    Workflow Replay
    Onboarding Flow
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Install

```bash
pnpm install
```

### Configure

Add your API keys to `.env` in the root folder:

```bash
# Choose one provider
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
OPENAI_API_KEY=sk-...

# Or use Anthropic
# LLM_PROVIDER=anthropic
# LLM_MODEL=claude-sonnet-4-6
# ANTHROPIC_API_KEY=sk-ant-...
```

### Development

```bash
pnpm dev
```

### Run Tests

```bash
pnpm test
```

---

## Design System: Liquid Monolith

Dark mode with glassmorphism accents. Apple-inspired flat minimalism.

- **Surface hierarchy**: `#131318` (deepest) to `#35343a` (lightest)
- **Accent**: `#5E5CE6` / `#C2C1FF` (purple)
- **Glass**: `rgba(19, 19, 24, 0.85)` + `backdrop-filter: blur(40px)`
- **Typography**: Inter + JetBrains Mono
- **Injected UI**: Shadow DOM for CSS isolation from host pages

---

## Future Roadmap

- Supabase sync layer for multi-device persistence
- Modal cloud sandbox for multi-language script execution
- VLM-powered workflow replay with self-healing selectors
- Team collaboration features (shared annotations, workflows)
- Plugin system for third-party injected scripts

---

## Project Structure

```
src/
  main/             Main process (Electron)
    __tests__/      Unit tests (134 tests)
    scripts/        Injected script strings
  preload/          IPC bridge scripts (tab, sidebar, topbar)
  renderer/         React apps
    sidebar/        AI sidebar (Chat, Synthesis, Sandbox, Workflow, Onboarding)
    topbar/         Tab bar + address bar
    common/         Shared components and hooks
.claude/docs/       Design documentation (10 docs)
resources/models/   Local AI model files
```

# Blueberry Browser

An AI-native browser where the AI doesn't wait in a sidebar for you to ask — it watches what you're doing, understands what you need, and helps before you ask.

---

## Design Philosophy

Every existing AI browser falls into one of two camps: **passive** (a chatbot sidebar that waits for your prompt) or **takeover** (an agent that controls the browser while you watch). Blueberry occupies the space between — an AI that is **embedded in your browsing loop**, sensing your intent from behavior and acting alongside you.

**"A browser that treats every tab as a workspace, every interaction as a signal, and every page as data the AI can read, annotate, and act on."**

### The Proactive AI Model

Blueberry's AI operates on three levels simultaneously:

| Level | What The AI Does | How It Triggers |
|-------|-----------------|-----------------|
| **Ambient Sensing** | Tracks your attention — where you dwell, how you scroll, when you hesitate, which tabs you compare | Always-on via rrweb behavioral stream. No user action needed. |
| **Contextual Assistance** | Highlights confusing content, offers page summaries, detects you're comparing tabs and builds a comparison table | Triggered by behavioral signals. AI intervenes only when confident. |
| **Active Execution** | Navigates pages, fills forms, extracts data, replays workflows — as an autonomous agent | Triggered by explicit user request in the sidebar chat. |

The key insight: **the AI should help at the right level at the right time.** Reading an article? It silently tracks your attention. Dwelling on something confusing? It subtly highlights it. Need to search across a website? You ask, and it executes a full multi-step agent workflow.

### Architecture: 6 Layers

| Layer | What It Does |
|-------|-------------|
| Browser Shell | Tabs, address bar, navigation — the viewport |
| Agent Runtime | Autonomous browser agent with 9 tools, multi-step task execution |
| Page Interaction | rrweb capture, JS injection, React-compatible DOM actions |
| Native Bridge | Secure IPC with whitelisted channels, Shadow DOM isolation |
| Data & Memory | SQLite persistence, browser history import, user profiling |
| Trust & Safety | Progressive disclosure, approval gates, reversible actions, annotation toggle |

### Key Principles

- **Proactive but not annoying** — AI starts silent, escalates only with behavioral evidence (dwell > 3s, scroll-back, rapid tab switching). Throttles after 3 dismissed annotations. User controls via eye icon toggle.
- **Privacy-first, local-first** — all behavioral data (rrweb events, attention signals, browsing history) stays on-device. Cloud is only used when you explicitly ask the AI to act.
- **Personalized from day one** — imports your Chrome/Safari/Firefox history on first launch, builds a profile of your interests, and tailors AI responses accordingly.
- **Autonomous agent when needed** — completes multi-step tasks end-to-end (navigate → find inputs → fill forms → read results) using a proper tool-chaining loop.
- **Dual-model** — local Qwen 0.5B for instant tooltips, cloud LLM (GPT-4o / Claude) for deep reasoning and agent tasks.
- **Event-sourced** — every AI action is logged, debuggable, and reversible.

---

## Features

### Proactive Intelligence (No User Action Required)

These features work in the background — the AI observes your behavior and helps when it detects a signal:

**Attention Engine** — Continuously tracks your browsing behavior via rrweb:
- Mouse dwell (3s+ without movement) → the AI thinks you're confused
- Slow scroll velocity → the AI thinks you're reading carefully
- Scroll-back (re-reading) → the AI thinks you missed something
- Rapid tab switching (3+ in 60s) → the AI thinks you're comparing

**Page Annotations** — When the attention engine detects confusion, subtle purple highlights appear on the content you're dwelling on. Disabled by default — toggle via the eye icon in the address bar. Progressive disclosure: throttles after 3 dismissed annotations, backs off for 10 minutes.

**Cross-Tab Synthesis** — When you're rapidly switching between tabs (e.g., comparing GPU providers), a banner appears: *"Comparing 3 tabs? Generate a comparison table?"* Click to get a structured comparison with recommendations.

**Ghost Text Auto-Completion** — As you type in any text field on any webpage, AI-predicted completions appear as dimmed ghost text. Context-aware of your other open tabs and browsing history. Tab to accept, Esc to dismiss.

### Contextual Tools (User-Triggered, Context-Aware)

These features are triggered by a specific user action, but the AI uses full page context:

**Text Selection Pill** — Select any text on a page and a floating glass pill appears:
- **Explain** — inline tooltip with 1-2 sentence explanation, rendered below the selection (not in sidebar)
- **Ask AI** — opens sidebar with selected text + surrounding paragraph as context

**Page Summarization** — Click "Summarize Page" in the sidebar:
- Classifies the page type (article, docs, product, dashboard)
- Generates a TL;DR summary
- Lists clickable key points that scroll to the relevant section on the page

### Autonomous Agent (9 Browser Tools)

When you ask the AI to *do something*, it becomes a full autonomous browser agent:

| Tool | What It Does |
|------|-------------|
| `navigate` | Go to any URL, waits for page load |
| `click` | Click elements by CSS selector |
| `type_text` | Type into inputs with placeholder/aria-label fallback |
| `find_and_fill_input` | Deep input finder — Shadow DOM, React native setter, auto-submits |
| `scroll` | Scroll up or down |
| `read_page` | Read page text content |
| `run_javascript` | Execute custom JS on the page |
| `run_in_sandbox` | Execute JS in isolated cloud sandbox (Modal) for safe data extraction |
| `get_page_elements` | List buttons, links, and inputs on the page |

Example: *"Go to blocket.se and search for a hello kitty bag"* — the agent navigates, finds the search input (even in Shadow DOM), fills it using React-compatible native setter, submits, and reads the results. All steps shown in the chat.

### Code Sandbox (Modal Cloud + Local Fallback)

Ask the AI to extract data from a page:
- *"Extract all the links from this page"*
- *"Get all headings and their text"*
- *"Find all prices on this page"*

The AI writes JavaScript, executes it in an **isolated cloud sandbox** (Modal with Node.js + jsdom + Playwright), and shows the results in chat.

| Mode | When | Runtime |
|------|------|---------|
| **Modal (cloud)** | `MODAL_TOKEN_ID` is set in `.env` | Debian container with Node.js 20, jsdom, Playwright + Chromium |
| **Local (fallback)** | Modal tokens not configured or Modal unreachable | Electron WebContentsView with `sandbox: true` |

Modal also provides `run_playwright` for full browser automation in the cloud (navigate, click, type, screenshot in a headless Chromium).

### Workflow Recorder

- Click "Record Workflow" to capture browsing actions (clicks, typing, navigation)
- Step-by-step replay view with numbered steps and time offsets
- "Replay Now" re-executes the recorded actions on the live page
- "Save Workflow" persists to SQLite for future use

### Browser History Import

On first launch, import Chrome/Safari/Firefox browsing history:
- Reads the browser's SQLite database (copied to temp to avoid locks)
- Builds a user profile: top domains, topic clusters, inferred interests
- Personalizes the AI system prompt with your interests
- Everything processed locally — never sent to cloud

### Local AI Model

Qwen2.5-0.5B-Instruct runs locally via ONNX Runtime + WebGPU/WASM:
- Powers instant "Explain" tooltips without API calls
- Downloads from HuggingFace Hub on first launch (~460MB), cached after
- Falls back to WASM if WebGPU unavailable
- Wired into ModelRouter for automatic local/cloud routing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App Shell | Electron 37 + electron-vite |
| Renderer | React 19 + Tailwind CSS |
| State Management | React Context + Zustand |
| Local Database | sql.js (SQLite via WASM, no native module issues) |
| Cloud LLM | Vercel AI SDK 5 + OpenAI / Anthropic (configurable via `.env`) |
| Agent Loop | `streamText` + `stopWhen: stepCountIs(10)` + `jsonSchema` tools |
| Local Model | Qwen2.5-0.5B via @huggingface/transformers |
| Cloud Sandbox | Modal (Debian + Node.js 20 + Playwright + Chromium + jsdom) |
| Session Recording | rrweb v2 (CDN-loaded into tabs) |
| Testing | Vitest (134 unit tests across 17 test files) |

---

## Architecture

```
Electron App
  Main Process
    EventBus            Central pub/sub for all events
    RrwebRingBuffer     Capped in-memory behavioral event store (50MB)
    AIEventLog          Append-only log of all AI actions
    AttentionEngine     Dwell, scroll, tab-switch detection
    AnnotationManager   Progressive disclosure highlights (toggle via eye icon)
    CompletionEngine    Ghost text completions
    TabSynthesizer      Cross-tab comparison detection + generation
    PageRewriter        Page type classification + TL;DR with clickable anchors
    SandboxManager      Modal cloud sandbox (primary) + local WebContentsView (fallback)
    WorkflowRecorder    Records rrweb events into structured action logs
    LocalModelManager   Qwen2.5-0.5B in hidden WebContentsView
    ModelRouter         Routes between local (fast) and cloud (deep) models
    BrowserTools        9 tools: navigate, click, type_text, find_and_fill_input,
                        scroll, read_page, run_javascript, run_in_sandbox,
                        get_page_elements
    StorageBackend      SQLite persistence (Supabase-ready interface)
    LLM Provider        Configurable OpenAI/Anthropic via .env (no hardcoded models)

  Tab Views (per tab)
    Tab Preload IPC     Whitelisted channels (send: 4, receive: 5)
    Injected Scripts    rrweb-capture, selection-pill, ghost-text,
                        page-annotations, page-rewriter

  Sidebar (React)
    Chat + Agent Tools  Multi-step tool results rendered in chat
    Synthesis View      Comparison table from cross-tab analysis
    Sandbox Results     Formatted JSON output with "Apply to Page"
    Workflow Replay     Step list with live replay execution
    Onboarding Flow     Chrome/Safari/Firefox history import with profile
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

Create `.env` in the root folder:

```bash
# LLM Provider (choose one)
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
OPENAI_API_KEY=sk-...

# Or use Anthropic
# LLM_PROVIDER=anthropic
# LLM_MODEL=claude-sonnet-4-6
# ANTHROPIC_API_KEY=sk-ant-...

# Modal cloud sandbox (enables cloud execution with Playwright + jsdom)
MODAL_TOKEN_ID=ak-...
MODAL_TOKEN_SECRET=as-...
# Deploy first: cd modal-sandbox && modal deploy app.py
```

### Development

```bash
pnpm dev
```

### Run Tests

```bash
pnpm test        # 134 tests
pnpm test:watch  # watch mode
```

---

## Design System: Liquid Monolith

Dark mode with glassmorphism accents. Apple-inspired flat minimalism.

- **Surface hierarchy**: `#131318` (deepest) to `#35343a` (lightest)
- **Accent**: `#5E5CE6` / `#C2C1FF` (purple)
- **Glass panels**: `rgba(19, 19, 24, 0.85)` + `backdrop-filter: blur(40px)`
- **Typography**: Inter (UI) + JetBrains Mono (code/labels)
- **Injected UI**: Shadow DOM for CSS isolation from host pages
- **Animations**: 150-300ms ease-out, reduced motion respected

---

## Key Technical Decisions

| Decision | Why |
|----------|-----|
| `jsonSchema()` over `zod` for tools | zod schemas generate `type: "None"` which OpenAI rejects |
| `stopWhen: stepCountIs(10)` over `maxSteps` | Proper multi-step agent loop — SDK auto-feeds tool results back |
| Native value setter for inputs | `el.value = x` doesn't update React state; native setter does |
| `sql.js` over `better-sqlite3` | No native module rebuild needed — works in both Node (tests) and Electron (app) |
| `find_and_fill_input` with Shadow DOM search | Many modern sites render inputs in Shadow DOM — standard queries miss them |
| rrweb via CDN (not bundled) | Can't bundle Node modules into page context; CDN loads into tab renderer |
| Annotations disabled by default | Proactive AI highlighting can be annoying — user opts in via eye icon |
| `createOpenAI({ compatibility: 'strict' })` | Forces chat completions API instead of new responses API (better tool support) |

---

## Future Roadmap

- Supabase sync layer for multi-device persistence
- Modal sandbox: multi-language execution (Python, TypeScript) and VLM-powered visual verification
- VLM-powered visual page understanding (screenshot analysis)
- Workflow marketplace (share/import community workflows)
- Team collaboration (shared annotations, shared workflows)
- Plugin system for third-party injected scripts

---

## Project Structure

```
src/
  main/               Main process (Electron)
    __tests__/         134 unit tests across 17 files
    scripts/           Injected script strings (IIFE, Shadow DOM)
  preload/             IPC bridge scripts (tab, sidebar, topbar)
  renderer/            React apps
    sidebar/           AI sidebar (Chat, Synthesis, Sandbox, Workflow, Onboarding)
    topbar/            Tab bar + address bar + annotation toggle
    common/            Shared components and hooks
.claude/docs/          Design documentation (10 docs)
resources/models/      Local AI model files (Qwen2.5-0.5B)
modal-sandbox/         Modal cloud sandbox (Playwright + jsdom)
  app.py               Two functions: run_script + run_playwright
  README.md            Setup and API docs
```

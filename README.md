# Blueberry Browser

An AI-native browser where the AI co-pilot is embedded in the browsing experience — not waiting to be asked, not taking over completely, but co-browsing with you in real time.

---

## Design Philosophy

**"A browser that treats every tab as a workspace, every interaction as a signal, and every page as data the AI can read, annotate, and act on."**

Blueberry is built on a 6-layer architecture inspired by next-generation AI browsers:

| Layer | What It Does |
|-------|-------------|
| Browser Shell | Tabs, address bar, navigation — the viewport |
| Agent Runtime | Autonomous browser agent with 9 tools, multi-step task execution |
| Page Interaction | rrweb capture, JS injection, React-compatible DOM actions |
| Native Bridge | Secure IPC with whitelisted channels, Shadow DOM isolation |
| Data & Memory | SQLite persistence, browser history import, user profiling |
| Trust & Safety | Progressive disclosure, approval gates, reversible actions, annotation toggle |

### Key Principles

- **Privacy-first, local-first** — browsing data (rrweb events, history, attention signals) never leaves the device. Cloud is only used for deliberate user actions.
- **Autonomous agent** — the AI completes multi-step tasks end-to-end (navigate, find inputs, fill forms, read results) using `stopWhen: stepCountIs(10)` for proper tool chaining.
- **React-compatible** — uses native value setter (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`) to interact with React/Vue/Angular controlled inputs.
- **Dual-model architecture** — local model (Qwen 0.5B) for instant responses, cloud LLM (GPT-4o / Claude) for deep reasoning.
- **Event-sourced design** — every AI action is logged to AIEventLog, debuggable, and reversible.

---

## Features

### Browser Agent (9 Tools)

The AI sidebar chat is an autonomous browser agent that can take actions on the page:

| Tool | What It Does |
|------|-------------|
| `navigate` | Go to any URL, waits for page load |
| `click` | Click elements by CSS selector |
| `type_text` | Type into inputs with placeholder/aria-label fallback search |
| `find_and_fill_input` | Deep input finder — searches Shadow DOM, clicks search-like elements, uses React native setter, auto-submits |
| `scroll` | Scroll up or down |
| `read_page` | Read page text content |
| `run_javascript` | Execute custom JS on the page |
| `run_in_sandbox` | Execute JS in isolated sandbox against DOM snapshot (safe data extraction) |
| `get_page_elements` | List buttons, links, and inputs on the page |

Example: *"Go to blocket.se and search for a hello kitty bag"* — the agent navigates, finds the search input (even in Shadow DOM), fills it using React-compatible native setter, submits, and reads the results.

### Text Selection Pill

Select any text on a page and a floating glass pill appears:
- **Explain** — inline tooltip with 1-2 sentence explanation (no sidebar needed)
- **Ask AI** — opens sidebar with selected text as context for deeper conversation

### Ghost Text Auto-Completion

Copilot-style Tab completion in any text field on any webpage. Context-aware of your other open tabs and browsing history. 500ms debounce, Tab to accept, Esc to dismiss.

### Page Summarization

Click "Summarize Page" in the sidebar to get:
- Page type classification (article, docs, product, dashboard)
- TL;DR summary
- Clickable key points that scroll to the relevant section on the page

### Intelligent Sensing

- **Attention Engine** — Tracks mouse dwell (3s+), scroll velocity, scroll-back patterns, and tab switching via rrweb behavioral data
- **Page Annotations** — Proactive highlights on content you're dwelling on. Disabled by default — toggle via eye icon in address bar. Progressive disclosure (throttles after 3 dismissals)
- **Cross-Tab Synthesis** — Detects rapid tab switching (3+ in 60s), offers structured comparison table

### Code Sandbox

Ask the AI to extract data from a page:
- *"Extract all the links from this page"*
- *"Get all headings and their text"*
- *"Find all prices on this page"*

The AI writes JavaScript, executes it in an isolated sandbox against a DOM snapshot, and shows the results in chat.

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
    SandboxManager      Isolated WebContentsView for safe script execution
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

# Optional: Modal for cloud sandbox (not required for local sandbox)
# MODAL_TOKEN_ID=ak-...
# MODAL_TOKEN_SECRET=as-...
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
- Modal cloud sandbox for multi-language script execution (Python, TypeScript)
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
```

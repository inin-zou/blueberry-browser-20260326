# Architecture: Blueberry AI Co-Pilot

**Date:** 2026-03-26

---

## 0. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **App Shell** | Electron 37 + electron-vite | Existing codebase |
| **Renderer** | React 19 + Tailwind CSS | Existing codebase |
| **State (new features)** | Zustand | Lightweight, devtools, no boilerplate |
| **State (existing)** | React Context | Keep BrowserContext + ChatContext as-is |
| **Local DB** | better-sqlite3 | Synchronous, fast, no external service |
| **Future Sync** | Supabase (planned) | Cloud sync layer behind StorageBackend interface |
| **Cloud LLM** | Vercel AI SDK + OpenAI + Anthropic | Already integrated, dual-provider |
| **Local Model** | LFM2-VL 1.6B via ONNX Runtime Web + WebGPU | In-browser, no server, ~100ms inference |
| **Session Recording** | rrweb v2 | Battle-tested, DOM-level, compact |
| **Sandbox** | Modal (cloud containers) | Isolated, multi-language, existing experience |
| **Workflow Replay** | Modal + Playwright + cloud VLM | Self-healing selectors, visual verification |
| **Injected Script Build** | Separate TS files → esbuild → IIFE strings | TypeScript support, proper IDE experience |
| **Injected UI Styling** | TBD (design phase) | Will be decided during UI implementation |

### Design Philosophy: Privacy-First, Local-First

```
Sensitive data (NEVER leaves device):
  • rrweb event stream (mouse, scroll, clicks, keystrokes)
  • Attention signals and intent classifications
  • Imported browser history
  • Form fill data captured by rrweb
  • User profile and browsing patterns

Cloud data (only on deliberate user action):
  • Chat messages → Cloud LLM (OpenAI/Anthropic)
  • Page content for synthesis → Cloud LLM
  • Scripts for sandbox execution → Modal
  • Workflow replay → Modal + Playwright
```

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Electron App                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Main Process                             │ │
│  │                                                            │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────────┐ │ │
│  │  │ Window     │ │ EventMgr   │ │ Core Services          │ │ │
│  │  │ (existing) │ │ (existing) │ │                        │ │ │
│  │  │            │ │ + new IPC  │ │ • ModelRouter          │ │ │
│  │  │ TopBar     │ │ channels   │ │ • AttentionEngine      │ │ │
│  │  │ SideBar    │ │            │ │ • CompletionEngine     │ │ │
│  │  │ Tabs[]     │ │            │ │ • WorkflowRecorder     │ │ │
│  │  │ LocalModel │ │            │ │ • TabSynthesizer       │ │ │
│  │  │  View      │ │            │ │ • HistoryImporter      │ │ │
│  │  │ Sandbox    │ │            │ │ • SandboxManager       │ │ │
│  │  │  View      │ │            │ │ • SessionStore         │ │ │
│  │  └────────────┘ └────────────┘ └────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────┐ │
│  │  Tab Views   │ │  Sidebar     │ │ LocalModel │ │ Sandbox   │ │
│  │  (renderer)  │ │  (renderer)  │ │ View       │ │ View      │ │
│  │              │ │              │ │ (hidden)   │ │ (hidden)  │ │
│  │  Injected:   │ │  React App:  │ │            │ │           │ │
│  │  • rrweb     │ │  • Chat      │ │ LFM2-VL    │ │ Receives: │ │
│  │  • attention │ │  • Synthesis │ │ ONNX+WebGPU│ │ DOM snap  │ │
│  │  • ghost-text│ │  • Replay    │ │            │ │ + script  │ │
│  │  • sel. pill │ │  • Onboard   │ │            │ │           │ │
│  │  • annotator │ │  • Sandbox   │ │ Responds   │ │ Returns:  │ │
│  │  • rewriter  │ │    Results   │ │ to infer   │ │ result +  │ │
│  │              │ │              │ │ requests   │ │ errors    │ │
│  └──────────────┘ └──────────────┘ └────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Patterns

### 2.1 Event-Driven Pipeline (Core Pattern)

All features consume the same event stream. This is the central architectural decision.

```
Producer (rrweb in tab)
    │
    ▼
Event Bus (IPC channels in main process)
    │
    ├─→ Consumer: AttentionEngine
    ├─→ Consumer: CompletionEngine
    ├─→ Consumer: WorkflowRecorder
    └─→ Consumer: SessionStore (persistence)
```

**Why:** Every feature needs behavioral data (mouse, scroll, keystrokes, DOM mutations). Instead of each feature injecting its own listeners, rrweb captures everything once and the main process routes events to consumers. This avoids duplicate listeners, reduces page performance impact, and ensures all features see the same data.

**Pattern:** Observer/pub-sub via Electron IPC. Each engine subscribes to event types it cares about.

```typescript
// EventBus interface (main process)
interface EventBus {
  on(eventType: string, handler: (event: any) => void): void
  off(eventType: string, handler: (event: any) => void): void
  emit(eventType: string, event: any): void
}
```

### 2.1.1 AI Event Log (Event-Sourced Design)

Every AI action is logged as an immutable event. This enables debugging, trust, and future learning.

```typescript
// Every AI output is an event, not just a side effect
interface AIEvent {
  id: string
  timestamp: number
  tabId: string
  type: 'annotation' | 'ghost-text' | 'synthesis' | 'sandbox' | 'page-rewrite' | 'workflow-step' | 'selection-explain'
  trigger: {
    source: 'attention' | 'selection' | 'typing' | 'tab-switch' | 'user-chat' | 'manual'
    signal?: AttentionSignal      // what attention signal triggered this
    userInput?: string            // what the user typed/selected
  }
  output: {
    model: 'local' | 'cloud'
    content: any                  // the AI's response
    latencyMs: number
  }
  disposition: 'pending' | 'accepted' | 'dismissed' | 'expired'
  // accepted = user clicked Tab/Apply, dismissed = user hit Esc/clicked away, expired = timed out
}
```

**Why event-sourced:**
- **Debugging:** "Why did the AI annotate this?" → trace back to the attention signal
- **Trust:** User can see a history of everything the AI did and decided
- **Tuning:** Track accept/dismiss ratios per feature to tune thresholds
- **Replay:** Re-examine any AI decision after the fact

The `AIEventLog` is an append-only in-memory list (capped at 1000 events). Not persisted to SQLite in v1, but the interface supports it.

```typescript
class AIEventLog {
  private events: AIEvent[] = []
  private maxEvents = 1000

  log(event: AIEvent): void { ... }
  getByTab(tabId: string): AIEvent[] { ... }
  getByType(type: AIEvent['type']): AIEvent[] { ... }
  getAcceptRate(type: AIEvent['type']): number { ... }  // for threshold tuning
}
```

### 2.1.2 Tab as Execution Unit

Each tab is not just a renderer — it's a workspace with an event stream, attention profile, and context summary.

```typescript
// TabWorkspace extends the basic Tab with AI-relevant state
interface TabWorkspace {
  tab: Tab                              // existing Tab instance
  eventStream: RrwebEvent[]            // recent rrweb events for this tab (from ring buffer)
  attentionProfile: {
    dwellAreas: { selector: string; totalDwellMs: number }[]
    scrollPattern: 'skimming' | 'reading' | 'searching' | 'idle'
    currentIntent: AttentionIntent
  }
  contextSummary: {
    url: string
    title: string
    pageType: 'article' | 'documentation' | 'product' | 'dashboard' | 'search' | 'form' | 'unknown'
    extractedText: string             // truncated to 4000 chars
    lastUpdated: number
  }
  aiEvents: AIEvent[]                  // AI actions taken on this tab
}
```

This is maintained by the main process. When any engine needs tab context, it reads from `TabWorkspace` instead of re-extracting from the page every time.

### 2.1.3 Design Rules

- **Never inject React into a tab** — injected scripts are vanilla JS, no framework overhead
- **Hot path stays local** — rrweb events, attention signals, ghost text rendering: all in-process, <200ms
- **Cold path tolerates latency** — LLM chat, sandbox execution, synthesis: cloud, 1-5s acceptable
- **Every AI output is reversible** — annotations dismiss, ghost text requires Tab, sandbox requires Apply

### 2.2 Model Router (Strategy Pattern)

A single entry point decides which model handles each request.

```typescript
interface InferenceRequest {
  task: 'completion' | 'explain' | 'synthesize' | 'rewrite' | 'classify'
  input: { text?: string; image?: string; context?: Context }
  latencyBudget: 'fast' | 'normal'  // fast = <200ms, normal = <5s
  confidenceThreshold?: number       // escalate to cloud if below
}

interface InferenceResponse {
  result: string
  model: 'local' | 'cloud'
  confidence: number
  latencyMs: number
}
```

**Routing rules:**

| Task | Latency Budget | Primary Model | Fallback |
|------|---------------|---------------|----------|
| Ghost text completion | fast | LFM2-VL | Simple heuristic (history match) |
| Quick explain (划词) | fast | LFM2-VL | Cloud LLM |
| Page type classification | fast | LFM2-VL | URL pattern matching |
| Attention intent interpretation | fast | LFM2-VL | Rule-based thresholds |
| Chat conversation | normal | Cloud LLM | — |
| Cross-tab synthesis | normal | Cloud LLM | — |
| Page rewrite instructions | normal | Cloud LLM | — |
| Workflow summarization | normal | Cloud LLM | — |
| Sandbox code generation | normal | Cloud LLM | — |
| Workflow replay VLM (find element) | normal | Cloud LLM (vision) | — |
| Workflow replay VLM (verify action) | normal | Cloud LLM (vision) | — |

### 2.3 Injection Registry (Facade Pattern)

All scripts injected into tabs are managed through a single registry.

```typescript
interface InjectionRegistry {
  // Register a script to inject into all tabs
  register(name: string, script: string, options: InjectionOptions): void

  // Inject all registered scripts into a tab
  injectAll(tab: Tab): Promise<void>

  // Re-inject after navigation (SPA page change or full reload)
  reinjectOnNavigation(tab: Tab): void

  // Remove specific injection
  remove(name: string, tab: Tab): Promise<void>
}

interface InjectionOptions {
  runAt: 'document-start' | 'document-idle' | 'document-end'
  persistent: boolean  // re-inject on navigation?
  dependencies: string[]  // other scripts that must load first
}
```

**Injection dependency order:**
```
1. rrweb-capture.js        (no deps — must be first)
2. attention-tracker.js    (depends on: rrweb-capture)
3. ghost-text.js           (depends on: rrweb-capture)
4. selection-pill.js       (no deps)
5. page-annotations.js     (no deps)
6. page-rewriter.js        (no deps)
```

### 2.4 Sandbox Manager (Modal Cloud Isolation)

Manages script execution in Modal cloud containers for full isolation and multi-language support.

```typescript
interface SandboxManager {
  // Execute a script against a DOM snapshot (via Modal)
  execute(request: SandboxRequest): Promise<SandboxResult>

  // Kill a running execution
  kill(executionId: string): Promise<void>

  // Execute locally (fallback for simple JS when Modal unavailable)
  executeLocal(request: SandboxRequest): Promise<SandboxResult>

  // Get execution history
  getHistory(): SandboxExecution[]
}

interface SandboxRequest {
  id: string
  domSnapshot: string           // serialized HTML from tab
  script: string                // AI-generated code
  language: 'javascript' | 'python' | 'typescript'
  timeout: number               // max execution time (default 30s)
  sourceTabId: string           // which tab's DOM was snapshotted
  dependencies?: string[]       // npm/pip packages to install
}

interface SandboxResult {
  id: string
  status: 'success' | 'error' | 'timeout'
  output: any                   // script return value
  consoleOutput: string[]       // captured console/print output
  error?: string                // error message if failed
  executionTimeMs: number
  script: string                // the script that was run (for display)
  containerCost?: number        // Modal execution cost in cents
}
```

**Why Modal (not local WebContentsView):**
- True OS-level container isolation — not just browser sandbox
- Multi-language: run Python, TypeScript, not just browser JS
- Can install npm/pip packages per execution
- Scalable — heavy scripts don't block the browser
- Team has existing Modal experience
- Can run Playwright for workflow replay in same infrastructure

**Architecture:**

```
Main Process (Electron)
    │
    ├─→ SandboxManager.execute(request)
    │     │
    │     ├─→ [Simple JS + Modal unavailable] → Local fallback
    │     │     └─→ Hidden WebContentsView with sandbox=true
    │     │         (same as original plan, kept as fallback)
    │     │
    │     └─→ [Default] → Modal API call
    │           │
    │           ▼
    │     Modal Container (ephemeral)
    │     ┌─────────────────────────┐
    │     │ • DOM snapshot loaded    │
    │     │ • Dependencies installed │
    │     │ • Script executed        │
    │     │ • Result captured        │
    │     │ • Container destroyed    │
    │     └─────────────────────────┘
    │           │
    │           ▼
    │     SandboxResult returned
    │
    ▼
Sidebar displays result + "Apply to page" button
```

**Local fallback (for offline / simple cases):**
- Hidden WebContentsView with `sandbox: true`, no network
- JS-only, no package installation
- Used when Modal is unreachable or for trivial scripts
- 10s timeout (vs 30s for Modal)

### 2.4.1 Workflow Replay via Modal + Playwright

Workflow replay uses the same Modal infrastructure but with Playwright and VLM:

```typescript
interface WorkflowReplayRequest {
  workflowId: string
  actions: WorkflowAction[]
  startUrl: string
  authCookies?: string          // optional: inject auth state
}

interface WorkflowReplayResult {
  status: 'completed' | 'failed' | 'needs_human'
  completedSteps: number
  totalSteps: number
  screenshots: { step: number; image: string }[]  // screenshot per step
  failedStep?: {
    step: number
    reason: string
    screenshot: string
    vlmAnalysis: string         // VLM explanation of what went wrong
  }
}
```

**Replay flow with VLM self-healing:**

```
Modal Container:
  1. Launch Playwright browser
  2. Navigate to startUrl
  3. For each WorkflowAction:
     a. Try CSS selector → click/type/etc.
     b. If selector fails:
        ├─→ Screenshot the page
        ├─→ Send to cloud VLM: "Find the [label] button"
        ├─→ VLM returns coordinates or new selector
        └─→ Retry with VLM-provided target
     c. Post-action verification:
        ├─→ Screenshot after action
        ├─→ VLM: "Did [expected outcome] happen?"
        └─→ Yes → next step / No → retry or flag
  4. Return results + screenshots for review
```

### 2.5 Sidebar View Manager (State Machine Pattern)

The sidebar switches between different view modes.

```
                    ┌─────────┐
         ┌─────────│  Chat    │◄────────────┐
         │         │ (default)│             │
         │         └────┬─────┘             │
         │              │                   │
    selection-action    synthesis-request   back-to-chat
    with context        │                   │
         │              ▼                   │
         │         ┌──────────┐             │
         │         │Synthesis │─────────────┘
         │         │  View    │
         │         └──────────┘
         │
         │         ┌──────────┐
         └────────▶│ Workflow  │─────────────┐
                   │  Replay   │             │
                   └──────────┘             │
                        │                   │
                   save-workflow        back-to-chat
                        │                   │
                        ▼                   │
                   ┌──────────┐             │
                   │ Onboard  │─────────────┘
                   │  Flow    │
                   └──────────┘
```

```typescript
type SidebarView = 'chat' | 'synthesis' | 'replay' | 'onboarding' | 'sandbox'

interface SidebarState {
  currentView: SidebarView
  chatContext?: { prefilledText: string; sourceUrl: string }
  synthesisData?: { tabs: TabContent[]; result: SynthesisResult }
  replayData?: { recording: RrwebRecording; summary: string }
  sandboxData?: { executions: SandboxExecution[]; activeExecution?: SandboxResult }
}
```

---

## 3. Data Models

### 3.1 Attention Signal

```typescript
interface AttentionSignal {
  id: string
  tabId: string
  timestamp: number
  type: 'dwell' | 'scroll_slow' | 'scroll_back' | 'click_hesitation' | 'tab_switch' | 'selection'
  data: {
    // For dwell/hesitation:
    position?: { x: number; y: number }
    selector?: string           // CSS selector of nearest element
    durationMs?: number

    // For scroll:
    scrollVelocity?: number     // pixels/second
    direction?: 'up' | 'down'

    // For tab_switch:
    fromTabId?: number
    toTabId?: number
    switchCount?: number        // times switched between same tabs in window

    // For selection:
    selectedText?: string
    surroundingContext?: string  // paragraph containing selection
  }
  intentGuess?: AttentionIntent
}

type AttentionIntent =
  | 'confused'           // long dwell + scroll-back
  | 'comparing'          // rapid tab switching
  | 'interested'         // slow scroll + moderate dwell
  | 'searching'          // scroll-down fast, occasional pauses
  | 'deciding'           // click hesitation on CTA buttons
  | 'unknown'
```

### 3.2 Completion Context

```typescript
interface CompletionContext {
  // Field info
  fieldType: 'input' | 'textarea' | 'contenteditable' | 'url-bar'
  fieldLabel?: string          // <label> text or placeholder
  fieldValue: string           // current text
  cursorPosition: number
  fieldSelector: string

  // Page context
  pageUrl: string
  pageTitle: string
  pageSection?: string         // heading/section containing the field

  // Browsing context
  openTabs: TabSummary[]       // title + URL of all open tabs
  recentHistory: HistoryEntry[] // last 10 pages visited
  recentFormFills: FormFill[]   // from rrweb, last 5 form interactions
}

interface TabSummary {
  id: string
  url: string
  title: string
  isActive: boolean
}

interface CompletionResult {
  suggestion: string
  confidence: number          // 0-1
  model: 'local' | 'cloud'
  displayMode: 'inline' | 'multi-line'
}
```

### 3.3 Workflow Recording

```typescript
interface WorkflowRecording {
  id: string
  name?: string                // user-assigned or AI-generated
  createdAt: number
  duration: number             // ms
  tabId: string

  // Raw rrweb recording (for visual replay)
  rrwebEvents: RrwebEvent[]

  // Structured action log (for automation replay)
  actions: WorkflowAction[]

  // AI-generated summary
  summary?: string
}

interface WorkflowAction {
  step: number
  timestamp: number
  action: 'navigate' | 'click' | 'type' | 'select' | 'scroll' | 'wait'
  data: {
    url?: string               // for navigate
    selector?: string          // CSS selector
    selectorFallbacks?: string[]  // backup selectors
    label?: string             // human-readable element description
    value?: string             // for type/select
    isParameterized?: boolean  // value should change between runs
    assertion?: string         // post-action verification selector
  }
}
```

### 3.4 Synthesis Result

```typescript
interface SynthesisResult {
  type: 'comparison' | 'summary' | 'conflict'
  sourceTabs: TabSummary[]

  // For comparison
  comparisonTable?: {
    headers: string[]
    rows: { label: string; values: string[] }[]
    recommendation?: string
  }

  // For summary
  mergedSummary?: {
    keyPoints: { point: string; sourceTabId: string }[]
    commonThemes: string[]
  }

  // For conflict
  conflicts?: {
    topic: string
    positions: { claim: string; sourceTabId: string }[]
  }[]
}
```

### 3.5 Sandbox Execution

```typescript
interface SandboxExecution {
  id: string
  timestamp: number
  sourceTabId: string
  sourceUrl: string
  prompt: string                // user's original request
  script: string                // AI-generated code
  result: SandboxResult
  appliedToPage: boolean        // whether user clicked "Apply"
}
```

### 3.6 User Profile (from history import)

```typescript
interface UserProfile {
  importedAt: number
  browsers: string[]           // ['chrome', 'safari']

  // Aggregated patterns
  topDomains: { domain: string; visitCount: number }[]
  topicClusters: { topic: string; domains: string[]; visitCount: number }[]
  temporalPatterns: {
    timeOfDay: { hour: number; domains: string[] }[]
    dayOfWeek: { day: number; domains: string[] }[]
  }

  // For URL completion
  frequentUrls: { url: string; title: string; frequency: number }[]

  // For personalization
  inferredInterests: string[]  // e.g., ['AI/ML', 'cloud infrastructure', 'mechanical keyboards']
}
```

---

## 4. Storage Strategy

### 4.1 Design: Local-First with Future Cloud Sync

```
Now (v1):
  All features → StorageBackend interface → SqliteBackend ��� local SQLite file

Future (v2):
  All features → StorageBackend interface → SupabaseSyncBackend
                                              ├─→ SqliteBackend (local, always)
                                              └─→ SupabaseClient (cloud, async background sync)
```

The `StorageBackend` interface is the key abstraction. Every feature reads/writes through it. Swapping SQLite for Supabase sync is a backend change, not a feature change.

```typescript
// Abstract interface — all features code against this
interface StorageBackend {
  // Workflows
  saveWorkflow(workflow: WorkflowRecording): Promise<void>
  getWorkflows(): Promise<WorkflowRecording[]>
  deleteWorkflow(id: string): Promise<void>

  // Saved scripts
  saveScript(script: SavedScript): Promise<void>
  getScriptsForUrl(url: string): Promise<SavedScript[]>
  deleteScript(id: string): Promise<void>

  // User profile
  saveProfile(profile: UserProfile): Promise<void>
  getProfile(): Promise<UserProfile | null>

  // URL completions
  saveUrls(entries: UrlCompletion[]): Promise<void>
  searchUrls(prefix: string, limit?: number): Promise<UrlCompletion[]>
}

// v1: Local-only implementation
class SqliteBackend implements StorageBackend {
  constructor(private db: BetterSqlite3.Database) {}
  // All methods read/write directly to SQLite
  // Synchronous under the hood (better-sqlite3), wrapped in Promise for interface
}

// v2 (future): Local + Supabase sync
class SupabaseSyncBackend implements StorageBackend {
  constructor(
    private local: SqliteBackend,           // always read/write local first
    private remote: SupabaseClient,         // async background sync
    private syncQueue: SyncQueue            // offline-safe write queue
  ) {}

  async saveWorkflow(workflow: WorkflowRecording): Promise<void> {
    await this.local.saveWorkflow(workflow)        // instant, local
    this.syncQueue.enqueue('workflows', workflow)   // background, async
  }

  async getWorkflows(): Promise<WorkflowRecording[]> {
    return this.local.getWorkflows()  // always read from local (fast)
  }
}
```

### 4.2 What Gets Stored Where

| Data | Storage | Lifetime | Max Size | Syncs to Cloud (future) |
|------|---------|----------|----------|------------------------|
| rrweb event stream | In-memory ring buffer | Current session only | 50MB (evicted) | Never — too sensitive |
| Attention signals | In-memory | Current session | Derived from rrweb | Never — too sensitive |
| Workflow recordings | SQLite (local) | Persistent until deleted | ~100KB each | Yes — user-created content |
| Saved scripts | SQLite (local) | Persistent until deleted | ~10KB each | Yes — user-created content |
| User profile | SQLite (local) | Persistent until cleared | ~500KB | Yes — preferences |
| URL completions | SQLite (local) | Persistent | ~5MB | Optional — contains history |
| Chat history | In-memory (existing) | Current session | Same as current | No |
| Completion cache | In-memory LRU | Current session | 1000 entries | No |
| Synthesis results | In-memory | Until tabs close | ~50KB each | No |
| Sandbox executions | In-memory | Current session | ~10KB each | No |

### 4.3 SQLite Schema (for persistent data)

```sql
-- Saved workflow recordings
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  actions_json TEXT NOT NULL,       -- JSON array of WorkflowAction
  rrweb_events_blob BLOB,          -- compressed rrweb events for replay
  summary TEXT,
  tags TEXT,                       -- comma-separated tags
  synced_at INTEGER                -- NULL = not synced (for future Supabase sync)
);

-- URL completion index (from imported history + session data)
CREATE TABLE url_completions (
  url TEXT PRIMARY KEY,
  title TEXT,
  visit_count INTEGER DEFAULT 1,
  last_visited INTEGER,
  domain TEXT,
  topic_cluster TEXT
);

CREATE INDEX idx_url_domain ON url_completions(domain);
CREATE INDEX idx_url_last_visited ON url_completions(last_visited DESC);

-- User profile
CREATE TABLE user_profile (
  key TEXT PRIMARY KEY,
  value_json TEXT,
  updated_at INTEGER
);

-- Saved sandbox scripts (user can save useful scripts for reuse)
CREATE TABLE saved_scripts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,            -- original user request
  script TEXT NOT NULL,            -- AI-generated code
  source_url_pattern TEXT,         -- URL pattern this script works on (e.g., 'amazon.com/*')
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  use_count INTEGER DEFAULT 0,
  synced_at INTEGER                -- NULL = not synced (for future Supabase sync)
);
```

**Why SQLite now:** Zero config, file-based, synchronous reads (fast), works offline. The `synced_at` column is pre-wired for future Supabase integration — records with `NULL` synced_at haven't been pushed to cloud yet.

**Why Supabase later (not now):**
- Sync layer adds 2-3 days of work (conflict resolution, offline queue, auth flow)
- No demo impact — nobody will ask "does it sync across devices?"
- Privacy-first positioning is a competitive advantage
- The StorageBackend interface makes migration trivial

### 4.3 In-Memory Ring Buffer (for rrweb events)

```typescript
class RrwebRingBuffer {
  private buffer: RrwebEvent[]
  private maxSizeBytes: number = 50 * 1024 * 1024  // 50MB
  private currentSizeBytes: number = 0

  push(event: RrwebEvent): void {
    const size = this.estimateSize(event)
    while (this.currentSizeBytes + size > this.maxSizeBytes) {
      this.evictOldest()
    }
    this.buffer.push(event)
    this.currentSizeBytes += size
  }

  // Get events for a time range (for workflow save)
  getRange(startTime: number, endTime: number): RrwebEvent[] { ... }

  // Get last N minutes (for context building)
  getRecent(minutes: number): RrwebEvent[] { ... }
}
```

---

## 5. Reuse Strategy (Avoiding Future Refactors)

### 5.1 Shared Interfaces

All engines share common types to prevent divergence:

```typescript
// Shared across all engines
interface PageContext {
  url: string
  title: string
  tabId: string
  content?: string              // extracted text (truncated to 4000 chars)
  screenshot?: string           // data URL (for vision model)
}

interface TabContext extends PageContext {
  isActive: boolean
  lastAccessed: number
}

// Used by: CompletionEngine, AttentionEngine, LLMClient, TabSynthesizer
function buildPageContext(tab: Tab): Promise<PageContext>

// Used by: CompletionEngine, TabSynthesizer, LLMClient
function getAllTabContexts(window: Window): Promise<TabContext[]>
```

### 5.2 Reusable Components

| Component | Used By | Reuse Potential |
|-----------|---------|----------------|
| `EventBus` | All engines + SandboxManager | Central pub-sub, add new consumers without changing producers |
| `ModelRouter` | Completion, Attention, Explain, Classify | Single interface for any model call, swap models without changing consumers |
| `InjectionRegistry` | All injected scripts | Add new scripts without modifying Tab.ts |
| `PageContext builder` | Completion, Synthesis, Chat, Rewriter | One function to extract page context, used everywhere |
| `RrwebRingBuffer` | Attention, Workflow, Completion | Single event store, multiple readers |
| `SidebarViewManager` | Chat, Synthesis, Replay, Onboarding, Sandbox | Add new sidebar views without restructuring |
| `SandboxManager` | Chat (code requests), Workflow (verification), Page Rewrite (preview) | Isolated execution for any feature that generates code |

### 5.3 Extension Points (Designed for Future Growth)

```typescript
// New attention signals → just add a new type + detection rule
type AttentionSignalType = 'dwell' | 'scroll_slow' | ... | string  // extensible

// New injected scripts → just register with InjectionRegistry
injectionRegistry.register('new-feature', newFeatureScript, { ... })

// New sidebar views → just add to the union type + component map
type SidebarView = 'chat' | 'synthesis' | 'replay' | 'onboarding' | string

// New model providers → just add to ModelRouter's strategy map
modelRouter.registerProvider('gemini', geminiProvider)

// New page rewrite strategies → just add to the strategy map
rewriteStrategies.register('academic-paper', academicPaperRewriter)
```

### 5.4 What NOT to Abstract Prematurely

- Individual injected scripts (keep them simple, inline — don't build a framework)
- rrweb event filtering (each engine filters differently — let them)
- UI styling of annotations (page-specific, resist the urge to make a "theme system")
- Workflow action types (keep as simple strings, don't build an action class hierarchy)

---

## 6. IPC Channel Map

| Channel | Direction | Payload | Consumer |
|---------|-----------|---------|----------|
| `rrweb:event` | tab → main | `RrwebEvent` | EventBus → all engines |
| `attention:signal` | main → tab | `{type, selector, action}` | Injected annotator script |
| `completion:request` | tab → main | `CompletionContext` | CompletionEngine |
| `completion:response` | main → tab | `CompletionResult` | Injected ghost-text script |
| `selection:action` | tab → main | `{text, url, action, context}` | SideBar |
| `sidebar:open-with-context` | main → sidebar | `{text, url, mode}` | SidebarApp |
| `sidebar:set-view` | main → sidebar | `{view: SidebarView, data}` | SidebarViewManager |
| `synthesis:request` | sidebar → main | `{tabIds: string[]}` | TabSynthesizer |
| `synthesis:response` | main → sidebar | `SynthesisResult` | SynthesisView |
| `workflow:offer-save` | main → sidebar | `{recording, summary}` | WorkflowReplayPlayer |
| `workflow:replay` | sidebar → main | `{workflowId}` | WorkflowReplayer |
| `model:infer` | main → localmodel | `InferenceRequest` | LFM2-VL view |
| `model:result` | localmodel → main | `InferenceResponse` | ModelRouter |
| `history:import` | sidebar → main | `{browsers: string[]}` | HistoryImporter |
| `history:progress` | main → sidebar | `{percent, message}` | OnboardingFlow |
| `page:rewrite` | main → tab | `{instructions}` | Injected rewriter script |
| `page:restore` | main → tab | `{}` | Injected rewriter script |
| `sandbox:execute` | sidebar → main | `SandboxRequest` | SandboxManager → Modal API |
| `sandbox:result` | main → sidebar | `SandboxResult` | SandboxResultView |
| `sandbox:kill` | sidebar → main | `{executionId}` | SandboxManager → Modal API |
| `sandbox:apply` | sidebar → main | `{script, tabId}` | Apply sandbox result to live page via runJs() |
| `workflow:replay-start` | sidebar → main | `WorkflowReplayRequest` | SandboxManager → Modal + Playwright |
| `workflow:replay-progress` | main → sidebar | `{step, screenshot, status}` | WorkflowReplayPlayer |
| `workflow:replay-result` | main → sidebar | `WorkflowReplayResult` | WorkflowReplayPlayer |

---

## 7. Performance Budget

### Hot Path (< 200ms — must never block browsing)

| Metric | Target | Strategy |
|--------|--------|----------|
| rrweb overhead per tab | < 3% CPU | Mouse sampling at 50ms, scroll at 100ms |
| Ghost text latency (local) | < 200ms | LFM2-VL, skip if model busy |
| Attention annotation render | < 100ms | Pre-computed CSS classes, batch DOM updates |
| Selection pill appear | < 200ms | Pure DOM, no model call |
| Injection scripts total size | < 200KB | Bundle + minify, inject as string |
| rrweb memory usage | < 50MB | Ring buffer with eviction |

### Cold Path (1-5s acceptable — user-initiated actions)

| Metric | Target | Strategy |
|--------|--------|----------|
| Ghost text latency (cloud) | < 2s | Debounce 75ms, cancel in-flight on new keystroke |
| Sidebar chat response | < 3s first token | Streaming, show typing indicator |
| Cross-tab synthesis | < 5s | Show loading state with progress |
| Sandbox execution (Modal) | < 30s | Show execution status, timeout with retry |
| LFM2-VL model load | < 5s | Load on startup, keep in memory |
| LFM2-VL VRAM usage | < 2GB | 1.6B model quantized |
| Sandbox execution | < 10s | Hard timeout, kill on exceed |
| Sandbox memory | < 100MB | Destroy + recreate view on exceed |
| DOM snapshot size | < 5MB | Truncate large DOMs before sending to sandbox |

---

## 8. Trust & Security Model

### 8.1 Autonomy Spectrum

Every AI feature sits on a spectrum from passive to autonomous. The further right, the more explicit user consent is required:

```
PASSIVE              PROACTIVE            ACTIVE               AUTONOMOUS
(user unaware)       (user can dismiss)   (user must accept)   (user must approve)
────────────────────────────────────────────────────────────────────────────────
rrweb capture        Annotations          Ghost text           Sandbox apply
Attention tracking   Page highlights      Selection pill       Workflow replay
History analysis     Intent badges        Page rewrite toggle  Form auto-fill
```

**Rules:**
- Left side: runs silently, no user action needed, fully reversible
- Middle: appears proactively but requires user action to take effect (Tab, click)
- Right side: executes only after explicit user approval ("Apply to page", "Make replayable")

### 8.2 Approval Gates

| Action | Risk Level | Gate |
|--------|-----------|------|
| Show annotation on page | Low | None — auto-appears, Esc dismisses |
| Show ghost text | Low | None — appears, Tab to accept |
| Accept ghost text into field | Medium | Explicit Tab press required |
| Open sidebar with context | Low | Explicit pill click required |
| Apply page rewrite | Medium | Toggle button (reversible) |
| Execute sandbox script | Medium | User initiates via chat |
| Apply sandbox result to page | High | Explicit "Apply to page" button |
| Replay workflow | High | Explicit "Replay" button + step confirmations |
| Send data to cloud LLM | Medium | Implicit (user sent chat message) |

### 8.3 Process Isolation

| Component | Isolation | Network | Node APIs |
|-----------|-----------|---------|-----------|
| Tab WebContentsView | contextIsolation + sandbox | Full internet | None (preload bridge only) |
| Sidebar WebContentsView | contextIsolation | localhost only | Via preload |
| LFM2-VL hidden view | contextIsolation | None | None |
| Local sandbox view | contextIsolation + sandbox | None | None |
| Modal container | OS-level container | Controlled | Full (ephemeral) |

### 8.4 Data Privacy

| Data Type | Stays Local | Sent to Cloud | Justification |
|-----------|-------------|---------------|---------------|
| rrweb events | Always | Never | Most sensitive — behavioral fingerprint |
| Attention signals | Always | Never | Derived from rrweb |
| Browser history import | Always | Never | Personal browsing data |
| Form fill data | Always | Never | May contain passwords/PII |
| Page content (text) | Cached locally | On user chat/synthesis | Needed for LLM reasoning |
| Screenshots | Cached locally | On user chat | Needed for vision model |
| Sandbox scripts | Logged locally | Sent to Modal for execution | Code only, no user data |
| Chat messages | In-memory | Sent to LLM provider | User explicitly sends |

### 8.5 Security Controls

- **IPC whitelist:** Tab preload only exposes specific channels (see Fix 1 in 05-review-fixes.md)
- **Modal auth:** API key in `.env`, never exposed to renderer processes
- **DOM snapshots to Modal:** HTML only — no cookies, localStorage, or session data
- **Script logging:** All executed scripts logged in AIEventLog for audit
- **Workflow replay:** Human-in-the-loop checkpoints for auth/payment actions

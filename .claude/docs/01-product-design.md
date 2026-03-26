# Product Design: Blueberry AI Co-Pilot

**Date:** 2026-03-26

---

## 1. Vision

Blueberry is an **AI-native browsing experience** where the agent is embedded in the interaction loop — not waiting to be asked, not taking over completely, but co-browsing with the user in real time.

Core thesis: **browsing = cognition**, and the AI augments cognition at every layer.

### Competitive Positioning

| Existing AI Browsers | Blueberry |
|---------------------|-----------|
| AI waits for you to ask (Dia, Arc Max) | AI observes and proactively assists |
| Agent takes over completely (Atlas Agent Mode) | Human + agent co-browse together |
| Cloud-only, latency on every interaction | Dual-model: local (instant) + cloud (deep) |
| Chat sidebar is the only AI interface | AI lives ON the page: highlights, ghost text, annotations |
| Fresh context every session | Imports history, builds memory over time |

---

## 2. Feature Specs

### 2.1 Attention-Aware Co-Pilot

**What:** Detect what the user is paying attention to and proactively assist.

**Signals:**

| Signal | Detection | Interpretation |
|--------|-----------|---------------|
| Mouse dwell | Position unchanged > 2s | Reading/thinking about this area |
| Scroll velocity | delta/time ratio | Fast = skimming, slow = careful reading |
| Scroll-back | Direction reversal | Re-reading, missed something |
| Click hesitation | mouseDown delayed > 1s after hover | Unsure about clicking |
| Tab switching | >3 switches between same tabs in 60s | Comparing content |
| Text selection | selectionchange event | Highlighting something important |

**UX Behavior (Progressive Disclosure):**

```
Level 0: Passive — collect signals, no UI changes
    │
    ▼ (threshold: dwell > 3s on same area)
Level 1: Subtle — light highlight on attention area
    │
    ▼ (threshold: dwell > 6s, or scroll-back to same section)
Level 2: Active — show annotation/explanation near the attention point
    │
    ▼ (user clicks annotation)
Level 3: Deep — open sidebar with full context
```

**Anti-annoyance rules:**
- Annotations fade in slowly (opacity 0 → 0.7 over 500ms)
- Esc or click-away dismisses immediately
- 3 ignored suggestions in a row → reduce frequency for 10 minutes
- Never interrupt typing, scrolling, or active clicking
- No modals, no popups, no sounds

---

### 2.2 Auto-Completion (Ghost Text)

**What:** Cursor-style Tab completion in any text field on any webpage.

**Interaction model (identical to Copilot/Cursor):**
- User types → 75ms debounce → ghost text appears (dimmed, inline)
- **Tab** to accept full suggestion
- **Right arrow** to accept word-by-word
- **Esc** to dismiss
- Keep typing to refine (ghost text updates)

**Context hierarchy (most → least relevant):**

```
1. Current field content + field label/placeholder
2. Current page content (section the field is in)
3. Other open tabs (titles + key content)
4. Session actions (rrweb form data from current session)
5. Imported browser history (URL patterns, past searches)
```

**Use cases:**

| Where | Example |
|-------|---------|
| URL bar | Type "git" → ghost: "github.com/your-repo" (from history) |
| Gmail compose | Type "Thanks for the..." → "...GPU pricing analysis" (from tab context) |
| Search field | On Amazon, ghost suggests based on current research tabs |
| Form fields | Auto-fill from context (LinkedIn tab open → fill job app) |
| Any textarea | Writing context-aware of what you've been browsing |

**Model routing:**
- Simple completions (short, predictive) → LFM2-VL (local, <200ms)
- Complex completions (multi-sentence, requires reasoning) → Cloud LLM

---

### 2.3 划词 (Text Selection) → Pill → Sidebar

**What:** Select any text on a page → small floating pill → bridge to AI assistance.

**Flow:**

```
User selects text on page
    │
    ▼
Floating pill appears (200ms fade-in, positioned above selection)
┌────────────────────────────┐
│  💡 Explain    🔍 Ask AI   │
└────────────────────────────┘
    │
    ├─→ "Explain" (quick, local):
    │     LFM2-VL generates brief inline tooltip
    │     Shows below selection, dismisses on click-away
    │     If insufficient → "Want more?" link opens sidebar
    │
    ├─→ "Ask AI" (deep, sidebar):
    │     Sidebar opens (if closed)
    │     Chat pre-filled with: selected text + page URL + surrounding paragraph
    │     User can follow up in multi-turn conversation
    │
    └─→ Click away / 5s timeout:
          Pill disappears
```

**Why sidebar over popup:**
- More room for content (markdown, code blocks, long explanations)
- Multi-turn conversation possible
- Chat UI already built
- Context persists across interactions

---

### 2.4 Agent Visual Presence

**What:** AI makes its understanding visible on the page — highlights, annotations, a cursor.

**Intervention types:**

| Type | Trigger | Visual |
|------|---------|--------|
| Highlight | AI identifies key content on page | Subtle yellow/blue background on text spans |
| Margin note | User dwells on complex content | Small note in page margin with explanation |
| Pointer | Chat response references page element | Animated dot/pulse on the element |
| Inline simplification | Long dwell on dense text | Simplified rewrite appears below (toggleable) |
| Anomaly badge | Dashboard page, unusual metric | Red/orange badge with tooltip |

**All interventions are:**
- Non-blocking (never cover interactive elements)
- Dismissable (click X or right-click → "Remove hint")
- Reversible (undo button or toggle all off)
- Themed (match page's dark/light mode)

**Agent cursor (stretch goal):**
- Secondary cursor (subtle, different color) showing where AI is "looking"
- Like Figma multiplayer — ghostly collaborator presence
- Only visible when AI is actively analyzing

---

### 2.5 Context-Aware Page Rewrite

**What:** AI restructures page content to make it more useful for the user's current task.

**Transformations by page type:**

| Page Type | Detection | Transformation |
|-----------|-----------|---------------|
| Documentation | URL patterns, code blocks | Show relevant section only, quick-nav TOC |
| Long article | >2000 words, article tag | TL;DR panel, key points, reading progress bar |
| Product page | Price elements, cart buttons | Extract specs into structured comparison card |
| Dashboard | Charts, metrics, tables | Highlight anomalies, hide noise, add trend context |
| Search results | Search input + result list | Re-rank by user's actual intent |

**UX:**
- Triggered by: attention threshold (long page dwell) or manual toggle
- "Original / AI View" toggle always visible
- Transformations cached per URL
- Never modify forms, buttons, or interactive elements

---

### 2.6 Cross-Tab Synthesis

**What:** Detect related open tabs and offer unified analysis.

**Detection triggers:**
- Rapid tab switching between same 2-3 tabs (>3 switches in 60s)
- Multiple tabs with similar URLs or shared keywords in title

**Synthesis modes:**
- **Comparison table:** Extract structured data, align columns (e.g., 3 product tabs)
- **Summary merge:** Combine key points from multiple articles
- **Conflict detection:** Highlight where sources disagree

**Flow:**
1. Pattern detected → subtle notification in sidebar
2. "Comparing GPU providers? Want a summary?"
3. User clicks → cloud LLM receives content from all related tabs
4. Synthesis view renders in sidebar with linked references

---

### 2.7 Workflow Recorder & Replay

**What:** Record user workflows, visualize as PostHog-style session replay, convert to replayable automations.

**Recording:**
- Powered by rrweb — captures full DOM event stream
- Filters for action events: navigations, clicks, form fills, submissions
- Builds structured action log with selectors and labels

**Replay UI (in sidebar):**
- PostHog-style player: timeline, play/pause, 1x/2x/4x speed
- Visual playback: user sees their own cursor moving, pages loading
- Below player: AI-generated step-by-step summary
- "Make it replayable" → saves as executable automation

**Smart replay:**
- AI handles selector changes between runs
- AI infers parameterized values (e.g., "this month" → dynamic)
- Human-in-the-loop checkpoints for sensitive actions

---

### 2.8 Browser History Import

**What:** Personalize from day one by importing existing browsing data.

**Onboarding flow:**
1. First launch → "Import browsing history to personalize?"
2. Select browsers: Chrome / Firefox / Safari
3. Local processing with progress bar
4. Summary: "Found X patterns — you research AI tools, shop on Amazon, read HN daily"
5. User reviews + confirms (can delete anything)

**Data extracted:**
- URL frequency → predict future URLs
- Temporal patterns → time-of-day suggestions
- Topic clusters → personalize AI responses
- Frequently visited domains → auto-completion boost

**Privacy:** All processing local. Never sent to cloud. User can clear anytime.

---

### 2.9 Code Sandbox

**What:** An isolated execution environment where AI-generated scripts run safely against page content, giving the browser programmable superpowers.

**Why this matters:**
- The existing `runJs()` runs in the page's live context — it can break the page, trigger XSS, or cause side effects
- A sandbox lets the AI write and test code without risk
- It unlocks the "coding agent" use case from the README assignment
- Workflow replay scripts need a safe place to execute and verify before touching real pages

**Architecture:**
- A hidden `WebContentsView` with `sandbox: true`, no preload, no network access
- Receives: a DOM snapshot (serialized HTML) + a script to run
- Returns: execution result (data, errors, console output)
- The user reviews output before anything touches the live page

**Use cases:**

| Use Case | Flow |
|----------|------|
| **Data extraction** | "Extract all prices from this page" → AI writes script → sandbox runs it on DOM snapshot → returns structured data |
| **Page transformation preview** | AI generates page rewrite CSS/JS → sandbox renders preview → user approves → applied to live page |
| **Workflow step verification** | Before replaying a workflow step, dry-run the selector/action in sandbox → verify it works |
| **Custom user scripts** | User asks "make all images grayscale" → AI writes script → sandbox tests → user applies |
| **Form auto-fill validation** | AI generates form values → sandbox validates against field constraints → then fills live form |

**Interaction model:**

```
User (via sidebar chat): "Extract all product names and prices from this page"
    │
    ▼
Cloud LLM generates JavaScript
    │
    ▼
Main process snapshots current tab DOM
    │
    ▼
Sandbox WebContentsView receives: DOM snapshot + script
    │
    ├─→ Executes in full isolation
    ├─→ No network, no node, no file access
    ├─→ 10s timeout (kill if exceeds)
    │
    ▼
Result returned to sidebar
    │
    ├─→ Shows output: "Found 12 products: ..."
    ├─→ Shows code that was executed (collapsible)
    └─→ "Apply to page" button (if script modifies DOM)
```

**Safety controls:**
- Strict CSP: no eval beyond the sandboxed script, no network
- Execution timeout: 10 seconds max
- Memory limit: sandbox view killed if exceeds 100MB
- No access to cookies, localStorage, or IndexedDB of original page
- User must explicitly approve before any result is applied to live page
- All executed scripts logged for transparency

**UX:**
- Code output shown in sidebar with syntax highlighting
- "Run again" / "Modify" buttons for iteration
- Execution status: running → success/error with details
- History of past sandbox executions (collapsible list)

---

## 3. Demo Narrative

A single 2-minute flow that showcases all features naturally:

### Scene 1: "It Already Knows You" (10s)
First launch → import Chrome history → "You research AI tools and shop on Amazon."

### Scene 2: "划词 → Deep Dive" (30s)
Reading a blog → select confusing paragraph → pill appears → "Ask AI" → sidebar explains with cross-tab reference: "This relates to the paper in tab 3."

### Scene 2.5: "It Finishes Your Thoughts" (20s)
Open Gmail → type "Thanks for the..." → ghost text: "...GPU pricing analysis" (from tab context) → Tab to accept.

### Scene 3: "The Page Comes Alive" (30s)
Dwell on complex diagram → annotations fade in → key terms highlighted → simplified summary appears inline. Agent highlights the important part. You didn't ask.

### Scene 4: "Cross-Tab Decision Engine" (30s)
3 GPU provider tabs → switch between them → sidebar: "Comparing? Want a summary?" → structured comparison table with recommendation.

### Scene 5: "Code It For Me" (20s)
Browsing a data-heavy page. Ask in sidebar: "Extract all the product names and prices into a table." AI writes a script, runs it in the sandbox, returns clean structured data. Click "Apply" → data appears in sidebar. No manual scraping.

### Scene 6: "Record & Replay" (20s)
Do a 3-step export task → browser offers replay → PostHog-style player → "Make it replayable" → saved as automation.

---

## 4. UX Principles

1. **Progressive disclosure:** Start silent, escalate only with evidence of need
2. **Non-interruptive:** Never modal, never blocking, never sounds
3. **Reversible:** Every AI action can be undone
4. **Transparent:** User can see why AI made a suggestion
5. **Fast or invisible:** Local model for <200ms tasks, cloud for deep tasks (with loading state)
6. **Respect the page:** Never break interactive elements, forms, or navigation

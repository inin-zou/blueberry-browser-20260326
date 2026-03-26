# Design Philosophy: Blueberry as an AI-Native Operating Surface

**Date:** 2026-03-26
**Context:** Informed by analysis of Strawberry's 6-layer architecture

---

## 1. The Core Reframe

Blueberry is not "a browser with AI features." It's an **operating surface** where:

- The **browser shell** is the viewport
- The **agent runtime** is the brain
- The **page** is both input and output
- The **user** is a collaborator, not just a passenger

One sentence: **"A browser that treats every tab as a workspace, every interaction as a signal, and every page as data the AI can read, annotate, and act on."**

---

## 2. How Blueberry Maps to the 6-Layer Model

Strawberry's architecture can be decomposed into 6 layers. Blueberry implements a focused subset, but with the same structural thinking:

```
Layer                          Strawberry (full product)          Blueberry (challenge scope)
─────────────────────────────────────────────────────────────────────────────────────────────
1. Browser Shell               Full browser, tab groups,          Existing shell (tabs, address
                                split view, history sidebar,       bar, nav). Enhance with smart
                                Svelte UI rewrite                  URL bar, history import.

2. Agent Runtime               Long-running task orchestrator,    Attention Engine + intent
                                state machine (planning →          classification. Not full
                                executing → approval →             task orchestrator, but the
                                completed), user interrupt         sensing layer that feeds one.

3. Page Interaction             DOM agent + vision agent,          rrweb capture + JS injection
                                form fill, wait for selector,      (pill, ghost text, annotations,
                                multi-tab coordination             page rewrite). Hybrid: DOM
                                                                   reading + LFM2-VL vision.

4. Native Bridge               contextBridge, IPC whitelist,      Add tab preload bridge.
                                sandbox, strict permissions        White-listed IPC channels.
                                                                   Sandboxed tab renderers.

5. Data / Memory / Integration  Long-term memory, SaaS            SQLite (local-first), browser
                                connectors (Gmail, Slack,          history import, StorageBackend
                                Sheets, CRM), routine              interface for future Supabase.
                                scheduler, team collaboration      No SaaS integrations yet.

6. Trust / Safety               Approval gates, countdown,        Ghost text: Tab to accept
                                action classification,             (never auto-submit). Sandbox:
                                audit log, kill switch,            user approves before apply.
                                policy engine                      Annotations: dismissable,
                                                                   progressive disclosure.
```

---

## 3. The 5 Design Tradeoffs (and Where Blueberry Stands)

### Tradeoff 1: Multi-Process Isolation vs Performance

**Strawberry's approach:** Chromium multi-process model. Each tab is isolated. Agent updates stream across processes.

**Blueberry's position:** Same model (Electron WebContentsViews). But we add:
- rrweb running in every tab → events must flow efficiently via IPC bridge
- LFM2-VL in a hidden WebContentsView → inference without blocking tabs
- Modal sandbox → heavy execution off-device entirely

**Design rule:** Hot path (rrweb events, attention signals) stays in-process. Cold path (LLM calls, sandbox, synthesis) can tolerate latency.

### Tradeoff 2: UI Framework Speed vs Dev Velocity

**Strawberry's approach:** Migrated React → Svelte for 2x performance (their words). Browser UI is not a normal web app — high-frequency agent updates + multi-renderer make React's reconciliation expensive.

**Blueberry's position:** Keep React (existing codebase, 2-week deadline) but:
- Use Zustand for new features (less re-render overhead than Context)
- Keep sidebar view switching lean (unmount inactive views)
- Injected page scripts are vanilla JS (no framework overhead in tabs)

**Design rule:** React for our UI. Vanilla JS for anything injected into web pages. Never inject React into a tab.

### Tradeoff 3: Generic Computer-Use vs Domain Shortcuts

**Strawberry's approach:** Both — browser automation for generic tasks, direct API integration (Gmail, Sheets, Slack) for speed and reliability.

**Blueberry's position:** Generic-first (we don't have SaaS integrations). But the architecture supports shortcuts:
- Modal sandbox can call APIs directly (not just DOM manipulation)
- Workflow recorder can capture both DOM actions AND API calls
- StorageBackend interface is designed for future integration connectors

**Design rule:** Build the generic layer well. Shortcuts are a future optimization, not a v1 requirement.

### Tradeoff 4: Agent Autonomy vs User Trust

**Strawberry's approach:** Low-risk auto, high-risk approval, countdown window, kill switch, audit log.

**Blueberry's position:** This is our strongest design principle.

```
Autonomy spectrum:

  FULLY PASSIVE                                              FULLY AUTONOMOUS
  ────────────────────────────────────────────────────────────────────────────
  │                    │                │                │                │
  Attention tracking   Annotations     Ghost text       Sandbox apply    Workflow replay
  (just watches)       (fade in,       (Tab to accept,  (user clicks     (Modal executes,
                       dismissable)    never auto)      "Apply")         VLM verifies)

  ← User unaware                                        User explicitly approves →
```

**Design rules:**
- **Never auto-submit** — ghost text waits for Tab. Always.
- **Never auto-apply** — sandbox results need "Apply to page" click.
- **Annotations are reversible** — Esc or click-away, gone instantly.
- **Progressive disclosure** — start silent, escalate with evidence.
- **Show the work** — sidebar shows code that was executed, not just results.

### Tradeoff 5: Local Execution vs Cloud Execution

**Strawberry's approach:** Hybrid. Browser-local for page ops, cloud for orchestration/scheduling/memory.

**Blueberry's position:** Same hybrid, made explicit:

| Execution Context | Local | Cloud |
|-------------------|-------|-------|
| **Why** | Has tab/page context, instant, private | Isolated, scalable, multi-language |
| **What runs here** | rrweb, attention engine, ghost text rendering, LFM2-VL inference, page injection | LLM chat, sandbox scripts (Modal), workflow replay (Playwright), synthesis |
| **Latency** | <200ms | 1-5s |
| **Data** | Sensitive (browsing data, keystrokes) | Non-sensitive (page content, user messages) |

**Design rule:** If it touches browsing behavior data, it runs locally. If it needs reasoning or isolation, it goes to cloud.

---

## 4. Tab as Execution Unit, Not Just UI Container

This is the key insight from Strawberry's architecture that Blueberry adopts:

**Traditional browser:** A tab is a viewport. You look at things in it.

**AI browser:** A tab is a **workspace**. The AI can:
- Read it (rrweb + getTabText + screenshots)
- Understand it (LFM2-VL page type detection)
- Annotate it (injected highlights, notes, simplifications)
- Record interactions in it (rrweb → workflow recorder)
- Execute code against it (sandbox → apply to page)
- Relate it to other tabs (cross-tab synthesis)

Every tab has an **event stream** (rrweb), an **attention profile** (dwell/scroll/click patterns), and a **context summary** (URL + title + extracted text). These three pieces make the tab a first-class data entity, not just a rendering surface.

```
Traditional: User → Tab → Page (passive display)

Blueberry:   User ←→ Tab ←→ AI
                      │
              ┌───────┼───────┐
              ▼       ▼       ▼
          Events   Context   Actions
         (rrweb)  (content)  (inject)
```

---

## 5. The Sensing → Thinking → Acting Loop

Blueberry's features map cleanly to a perception-cognition-action loop:

```
SENSE                           THINK                          ACT
(what's happening)              (what does it mean)            (what to do)

rrweb events ──────────────────→ Attention Engine ────────────→ Annotations on page
  mouse, scroll, clicks           intent: confused/comparing     highlights, notes

Text selection ────────────────→ Context assembly ────────────→ Selection pill → sidebar
  user highlights text            page + tabs + history          explain, ask AI

Keystroke in field ────────────→ Completion Engine ───────────→ Ghost text overlay
  user typing                     field + page + tabs context    Tab to accept

Tab switching ─────────────────→ Pattern detection ───────────→ Synthesis offer
  rapid tab changes               "comparing 3 providers"        comparison table

Page content ──────────────────→ Page type classification ────→ Page rewrite
  DOM structure, URL               article/dashboard/product     TL;DR, highlights

User actions ──────────────────→ Workflow extraction ─────────→ Replayable automation
  rrweb action log                 step-by-step summary          Modal + Playwright
```

Each row is independent — they can be built and demoed separately. But together they create the feeling of **a browser that understands what you're doing**.

---

## 6. What Makes This Different from "Browser + ChatGPT Sidebar"

| Dimension | ChatGPT Sidebar (current Blueberry) | AI-Native Browser (target) |
|-----------|-------------------------------------|---------------------------|
| **AI location** | In a sidebar panel | On the page, in the URL bar, in text fields, everywhere |
| **Trigger** | User types a message | Text selection, attention patterns, typing, tab switching |
| **Context** | Screenshot + page text (snapshot) | Live behavioral stream (rrweb) + cross-tab + history |
| **Response** | Text in sidebar | Highlights on page, ghost text in fields, comparison tables, workflow scripts |
| **Model** | Single cloud LLM | Dual: local VLM (instant) + cloud LLM (deep) |
| **Memory** | None (per-session) | Imported history, learned patterns, saved workflows |
| **Trust** | N/A (just chat) | Progressive disclosure, approval gates, reversible actions |

The transition from left column to right column is what the challenge submission demonstrates.

---

## 7. Architecture Principle: Event-Sourced Everything

Inspired by Strawberry's need for "observable execution trajectory":

Every AI action in Blueberry is **an event**, not a mutation. This means:

```typescript
// Every action the AI takes is logged
interface AIEvent {
  id: string
  timestamp: number
  tabId: string
  type: 'annotation' | 'ghost-text' | 'synthesis' | 'sandbox' | 'page-rewrite' | 'workflow-step'
  input: any       // what triggered it
  output: any      // what the AI produced
  applied: boolean // did the user accept it
  dismissed: boolean // did the user dismiss it
}
```

**Why this matters:**
- **Debugging:** "Why did the AI annotate this paragraph?" → check the attention signal that triggered it
- **Trust:** User can see a history of everything the AI did
- **Learning:** Track accept/dismiss ratios to tune thresholds
- **Replay:** Re-examine any AI decision after the fact

This isn't in v1 scope to build fully, but the architecture (EventBus, rrweb ring buffer) is designed to support it. Every engine emits events, not just side effects.

---

## 8. The Narrative for the Demo

When presenting to Strawberry, the narrative should be:

> "I analyzed Strawberry's architecture and identified 6 layers: browser shell, agent runtime, page interaction, native bridge, data/memory, and trust. For the Blueberry challenge, I focused on the layers that create the most visible differentiation: **page interaction** (making AI visible on the page, not just in a sidebar) and **agent runtime sensing** (attention tracking, intent detection). I also made deliberate architectural choices — event-sourced data flow, dual-model routing, StorageBackend abstraction — that show these features aren't hacks, they're a foundation for the full 6-layer stack."

This positions you as someone who:
1. Understands the full system, not just the feature
2. Made scoping decisions consciously, not by accident
3. Built foundations, not just demos
4. Thinks about trust and safety, not just functionality

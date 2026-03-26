# Implementation Plan: Blueberry AI Co-Pilot

**Date:** 2026-03-26

---

## 1. Build Phases

### Phase 0: Foundation (Day 1)
Set up the shared infrastructure that everything else depends on.

| Task | Description | Output |
|------|-------------|--------|
| 0.1 | Install dependencies: `rrweb`, `better-sqlite3`, `node-browser-history`, `modal`, `zustand` | package.json updated |
| 0.2 | Create `EventBus` in main process | `src/main/EventBus.ts` |
| 0.3 | Create `InjectionRegistry` + injection pipeline in Tab.ts | Scripts auto-inject on page load |
| 0.4 | Create `RrwebRingBuffer` for event storage | `src/main/RrwebRingBuffer.ts` |
| 0.5 | Create `ModelRouter` interface (cloud-only initially, local model added later) | `src/main/ModelRouter.ts` |
| 0.6 | Set up SQLite database with StorageBackend interface | `src/main/db.ts`, `src/main/StorageBackend.ts` |
| 0.7 | Bundle rrweb-capture.js and test injection into tabs | Working rrweb event stream |
| 0.8 | Create `AIEventLog` — append-only log of all AI actions | `src/main/AIEventLog.ts` |
| 0.9 | Create `TabWorkspace` — enriched tab model with event stream + attention profile + context summary | `src/main/TabWorkspace.ts` |
| 0.10 | Create `PageContext.ts` — shared `buildPageContext()` + `getAllTabContexts()` utilities | `src/main/PageContext.ts` |
| 0.11 | Create tab preload script with IPC bridge (Fix 1 from review) | `src/preload/tab.ts` |
| 0.12 | Fix `getTabHtml()` / `getTabText()` — remove invalid `return` (Fix 3 from review) | `src/main/Tab.ts` |

**Exit criteria:** rrweb events flowing from tabs → EventBus → RingBuffer. Tab preload bridge working. AIEventLog capturing events. Verified in console.

---

### Phase 1: Core Interactions (Days 2-4)
Build the two primary user-facing interactions.

| Task | Description | Depends On | Output |
|------|-------------|------------|--------|
| 1.1 | **划词 selection pill** — inject selection-pill.js, detect text selection, show floating pill | Phase 0 | Pill appears on text selection |
| 1.2 | **Pill → Sidebar bridge** — IPC from pill click to sidebar, pre-fill chat with context | 1.1 | "Ask AI" opens sidebar with context |
| 1.3 | **Enhanced sidebar** — accept pre-filled context, show source text highlight | 1.2 | Sidebar shows "About: [selected text]" |
| 1.4 | **Ghost text injection** — inject ghost-text.js, detect focused text fields | Phase 0 | Ghost text overlay renders |
| 1.5 | **Completion Engine** — receive context from ghost-text.js, query cloud LLM, return suggestion | 1.4 | Ghost text shows AI suggestions |
| 1.6 | **Tab/Esc interaction** — Tab to accept, Esc to dismiss, typing to refine | 1.5 | Full Copilot-style UX |
| 1.7 | **URL bar enhancement** — predict URLs from recent history + open tabs | 1.5 | Smart URL suggestions |

**Exit criteria:** Can select text → pill → sidebar chat. Can type in any field → ghost text appears → Tab to accept.

---

### Phase 2: Attention System (Days 4-6)
Make the browser aware of what you're looking at.

| Task | Description | Depends On | Output |
|------|-------------|------------|--------|
| 2.1 | **Attention Engine** — consume rrweb events, compute dwell/scroll/hesitation signals | Phase 0 | AttentionSignal events emitted |
| 2.2 | **Intent classification** — map signals to intents (confused, comparing, interested) | 2.1 | IntentGuess on each signal |
| 2.3 | **Annotation injection** — inject page-annotations.js, receive annotation commands | Phase 0 | Can render highlights/notes on page |
| 2.4 | **Attention → Annotation pipeline** — when intent=confused, show subtle annotation | 2.1, 2.3 | Auto-annotations on dwell |
| 2.5 | **Progressive disclosure** — throttle annotations, respect ignore signals | 2.4 | Non-annoying behavior |
| 2.6 | **Tab-switch detection** — detect rapid switching, emit "comparing" intent | 2.1 | Cross-tab comparison trigger |

**Exit criteria:** Dwelling on text → subtle highlight appears. Rapid tab switching → "comparing" intent detected.

---

### Phase 3: Browser History & Personalization (Day 6-7)

| Task | Description | Depends On | Output |
|------|-------------|------------|--------|
| 3.1 | **HistoryImporter** — read Chrome/Firefox/Safari history via node-browser-history | Phase 0 (SQLite) | Raw history data |
| 3.2 | **Profile builder** — cluster URLs, extract patterns, build UserProfile | 3.1 | UserProfile in SQLite |
| 3.3 | **URL completion boost** — feed history URLs into CompletionEngine | 3.2, 1.5 | History-aware URL predictions |
| 3.4 | **Onboarding UI** — first-launch flow in sidebar | 3.1 | OnboardingFlow.tsx |
| 3.5 | **Feed profile to LLM context** — include user interests in system prompt | 3.2 | Personalized AI responses |

**Exit criteria:** First launch shows import flow. History boosts URL completion. AI knows user interests.

---

### Phase 4: Cross-Tab Synthesis (Days 7-8)

| Task | Description | Depends On | Output |
|------|-------------|------------|--------|
| 4.1 | **TabSynthesizer** — detect related tabs, extract content from multiple tabs | 2.6 | Related tab detection |
| 4.2 | **Synthesis prompt** — structured output from cloud LLM (comparison table, summary) | 4.1 | SynthesisResult |
| 4.3 | **SynthesisView.tsx** — render comparison table in sidebar with tab references | 4.2 | Sidebar synthesis view |
| 4.4 | **Sidebar view switching** — chat ↔ synthesis toggle | 4.3 | SidebarViewManager |

**Exit criteria:** Open 3 similar tabs → switch between them → sidebar offers comparison → table renders.

---

### Phase 5: Page Rewriting (Days 8-9)

| Task | Description | Depends On | Output |
|------|-------------|------------|--------|
| 5.1 | **Page type classifier** — detect page type from URL + content structure | Phase 0 | PageType enum |
| 5.2 | **Rewrite strategies** — one strategy per page type (article TL;DR, dashboard highlights) | 5.1 | Rewrite instructions |
| 5.3 | **page-rewriter.js** — inject rewrite logic, apply transformations | 5.2 | Page visually restructured |
| 5.4 | **Toggle original/AI view** — button to switch between original and rewritten page | 5.3 | Reversible transformation |

**Exit criteria:** Open a long article → AI view shows TL;DR + key points. Toggle back to original.

---

### Phase 5.5: Code Sandbox (Days 9-10)

| Task | Description | Depends On | Output |
|------|-------------|------------|--------|
| 5.5.1 | **SandboxManager** — Modal client setup, API wrapper for container execution | Phase 0 | Modal execution working |
| 5.5.2 | **Local fallback** — hidden WebContentsView with sandbox=true for offline/simple JS | 5.5.1 | Dual execution paths |
| 5.5.3 | **DOM snapshot** — serialize current tab DOM as clean HTML string | Phase 0 | Snapshot function in Tab.ts |
| 5.5.4 | **Script execution pipeline** — send DOM + script to Modal, capture result | 5.5.1, 5.5.3 | Working sandbox execution |
| 5.5.5 | **Chat → Sandbox integration** — detect code requests in chat, route to sandbox | 5.5.4 | "Extract data from this page" works |
| 5.5.6 | **Sandbox results UI** — show output, code, "Apply to page" button in sidebar | 5.5.5 | SandboxResultView.tsx |
| 5.5.7 | **"Apply to page"** — execute approved script on live tab via runJs() | 5.5.6 | Safe code application |
| 5.5.8 | **Script saving** — save useful scripts to SQLite for reuse on matching URLs | 5.5.7 | saved_scripts table populated |

**Exit criteria:** Ask "extract all prices from this page" in chat → AI writes script → sandbox runs it → results shown → "Apply" works.

---

### Phase 6: Workflow Recording & Replay (Days 10-12)

| Task | Description | Depends On | Output |
|------|-------------|------------|--------|
| 6.1 | **WorkflowRecorder** — filter rrweb events into action log | Phase 0 | WorkflowRecording object |
| 6.2 | **Recording UI** — start/stop recording controls, auto-detect workflow end | 6.1 | Recording controls in sidebar |
| 6.3 | **rrweb Replayer integration** — PostHog-style visual replay in sidebar | 6.1 | WorkflowReplayPlayer.tsx |
| 6.4 | **AI summarization** — generate step-by-step summary from action log | 6.1 | Summary below replay |
| 6.5 | **"Make it replayable"** — convert recording to executable automation | 6.4 | Saved workflow in SQLite |
| 6.6 | **Workflow replay via Modal** — Playwright in Modal container, execute saved workflow | 6.5, 5.5.1 | Automated replay |
| 6.7 | **VLM self-healing** — screenshot + cloud VLM to find elements when selectors break | 6.6 | Robust replay |
| 6.8 | **VLM verification** — post-action screenshot → VLM confirms expected outcome | 6.7 | Verified replay steps |

**Exit criteria:** Record a workflow → visual replay in sidebar → save → replay execution works.

---

### Phase 7: Local Model (Days 12-14)

| Task | Description | Depends On | Output |
|------|-------------|------------|--------|
| 7.1 | **LocalModelManager** — create hidden WebContentsView, load LFM2-VL ONNX model | Phase 0 | Model loaded, ready for inference |
| 7.2 | **Inference IPC** — main process sends requests, model view returns results | 7.1 | Working local inference |
| 7.3 | **ModelRouter: local path** — route fast tasks to local model | 7.2, 0.5 | Dual model routing active |
| 7.4 | **Ghost text: local model** — use LFM2-VL for <200ms completions | 7.3, 1.5 | Faster ghost text |
| 7.5 | **Quick explain: local model** — 划词 "Explain" uses local model | 7.3, 1.1 | Instant inline explanations |
| 7.6 | **Page vision** — use LFM2-VL for page type detection + visual understanding | 7.3 | Vision-powered features |

**Exit criteria:** LFM2-VL running in hidden view. Ghost text <200ms. "Explain" works without cloud call.

---

### Phase 8: Polish & Demo (Days 14-15)

| Task | Description |
|------|-------------|
| 8.1 | Demo script rehearsal — run through all 6 hero scenes |
| 8.2 | Fix edge cases discovered during rehearsal |
| 8.3 | Performance tuning — reduce injection overhead, optimize model routing |
| 8.4 | Dark mode consistency across all injected UI |
| 8.5 | Error handling — graceful degradation when model fails or page blocks injection |
| 8.6 | README update with feature descriptions + screenshots |

---

## 2. Dependency Graph

```
Phase 0: Foundation
    │
    ├──────────────────────┬──────────────────┬──────────────────┐
    ▼                      ▼                  ▼                  ▼
Phase 1: Core         Phase 2: Attention  Phase 3: History   Phase 7: Local Model
(划词 + Ghost Text)    (Dwell + Signals)   (Import + Profile)  (LFM2-VL)
    │                      │                  │                  │
    │                      ▼                  │                  │
    │                 Phase 4: Synthesis ◄─────┘                 │
    │                      │                                     │
    │                      ▼                                     │
    │                 Phase 5: Page Rewrite                      │
    │                      │                                     │
    │                      ▼                                     │
    │                 Phase 5.5: Sandbox ◄────── (also used by   │
    │                      │                     Phase 6 & 1)    │
    │                      ▼                                     │
    │                 Phase 6: Workflow                           │
    │                      │                                     │
    └──────────────────────┴─────────────────────────────────────┘
                           │
                           ▼
                     Phase 8: Polish
```

**Key insight:** Phases 1, 2, 3, and 7 can all start in parallel after Phase 0 is done. This means we can parallelize aggressively in the first week.

---

## 3. New Dependencies

```json
{
  "dependencies": {
    "rrweb": "^2.x",
    "rrweb-player": "^2.x",
    "better-sqlite3": "^11.x",
    "node-browser-history": "^3.x",
    "modal": "^0.x",
    "zustand": "^5.x"
  },
  "devDependencies": {
    "@anthropic-ai/sdk": "existing",
    "@ai-sdk/openai": "existing"
  }
}
```

**Optional (for Phase 7 — Local Model):**
```json
{
  "dependencies": {
    "onnxruntime-web": "^1.x"
  }
}
```

**Future (Supabase sync layer):**
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x"
  }
}
```

---

## 4. File Creation Order

**Phase 0:**
```
src/preload/tab.ts              (IPC bridge for tabs — Fix 1)
src/main/EventBus.ts
src/main/RrwebRingBuffer.ts
src/main/AIEventLog.ts
src/main/TabWorkspace.ts
src/main/PageContext.ts
src/main/InjectionRegistry.ts
src/main/ModelRouter.ts
src/main/db.ts
src/main/StorageBackend.ts
src/renderer/common/injected/rrweb-capture.js
```

**Phase 1:**
```
src/renderer/common/injected/selection-pill.js
src/renderer/common/injected/ghost-text.js
src/main/CompletionEngine.ts
```

**Phase 2:**
```
src/main/AttentionEngine.ts
src/renderer/common/injected/attention-tracker.js
src/renderer/common/injected/page-annotations.js
```

**Phase 3:**
```
src/main/HistoryImporter.ts
src/renderer/sidebar/src/components/OnboardingFlow.tsx
```

**Phase 4:**
```
src/main/TabSynthesizer.ts
src/renderer/sidebar/src/components/SynthesisView.tsx
```

**Phase 5:**
```
src/renderer/common/injected/page-rewriter.js
```

**Phase 5.5:**
```
src/main/SandboxManager.ts
src/renderer/sidebar/src/components/SandboxResultView.tsx
```

**Phase 6:**
```
src/main/WorkflowRecorder.ts
src/main/WorkflowReplayer.ts
src/renderer/sidebar/src/components/WorkflowReplayPlayer.tsx
```

**Phase 7:**
```
src/main/LocalModelManager.ts
src/preload/localmodel.ts
src/preload/localmodel.d.ts
```

---

## 5. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| LFM2-VL too slow on target hardware | Ghost text unusable | Medium | Fallback to cloud; try 450M model |
| rrweb event volume overwhelms memory | App crashes | Low | Ring buffer with eviction (already designed) |
| Cross-origin pages block injection | Features fail on some sites | Medium | Graceful degradation, skip injection |
| Ghost text rendering breaks on complex inputs | Bad UX | Medium | Test on Gmail, Notion, Twitter; fallback to simpler overlay |
| Workflow replay selectors break | Replay fails | High | Multiple fallback selectors + AI re-detection |
| Proactive annotations feel annoying | Users disable features | Medium | Conservative thresholds, respect dismiss signals |
| WebGPU not available on some machines | Local model unusable | Low | Cloud-only fallback path |
| AI-generated sandbox scripts produce wrong results | Misleading output | Medium | Show code to user, require "Apply" confirmation |
| Sandbox DOM snapshot too large | Slow/OOM | Low | Truncate to 5MB, skip very large pages |

---

## 6. Testing Strategy

| Layer | Testing Approach |
|-------|-----------------|
| EventBus, RingBuffer | Unit tests (pure logic, no Electron) |
| AttentionEngine | Unit tests with mock rrweb events |
| CompletionEngine | Integration test: mock model, verify context assembly |
| Injected scripts | Manual testing on 5 target sites: Gmail, Amazon, GitHub, HN, Twitter |
| Ghost text rendering | Visual testing on different input types (input, textarea, contenteditable) |
| Workflow recorder | End-to-end: record → replay → verify same actions |
| Sandbox execution | Test with various AI-generated scripts: data extraction, DOM manipulation, edge cases |
| Sandbox safety | Verify no network access, timeout works, memory limit enforced |
| Full demo | Scripted walkthrough of all 6 hero scenes |

---

## 7. Open Questions to Resolve During Build

1. **rrweb version:** v2.x has breaking changes from v1. Verify Electron compatibility.
2. **better-sqlite3 vs sqlite3:** better-sqlite3 is synchronous (simpler), but needs native rebuild for Electron. Test build.
3. **LFM2-VL ONNX format:** Verify ONNX Runtime Web works inside Electron WebContentsView with WebGPU.
4. **Ghost text z-index:** Need to handle sites that use very high z-index values.
5. **rrweb + SPA navigation:** Verify rrweb re-initializes properly on SPA route changes.
6. **Sandbox WebContentsView creation cost:** Is creating/destroying views per execution too slow? May need to pool/reuse.
7. **Sandbox CSS fidelity:** DOM snapshot may lose external stylesheets. Decide if we need to inline CSS or if raw HTML is enough for script execution.

# Roadmap: Blueberry AI Co-Pilot

**Date:** 2026-03-26
**Deadline:** ~2 weeks (target: 2026-04-09)
**Status:** Planning complete, ready to build

---

## 1. Scope Tiers

Features are bucketed into three tiers. If time runs short, cut from the bottom up.

### Tier 1: Must Ship (Demo-Breaking if Missing)

These are the features that make the demo compelling. Without them, it's just "a browser with a chatbot sidebar" — which is what we already have.

| # | Feature | Why It's Must-Ship |
|---|---------|-------------------|
| F1 | 划词 → Pill → Sidebar | Primary interaction model — the "how you talk to AI" |
| F2 | Ghost Text Auto-Completion | Most visually impressive, "Copilot for browsing" narrative |
| F3 | Attention Tracking (dwell/scroll) | Core differentiator — "AI sees what you see" |
| F4 | Agent Visual Annotations | Makes AI visible ON the page, not just in sidebar |
| F5 | Browser History Import | "Personalized from day one" — strong onboarding moment |

### Tier 2: Should Ship (Makes Demo Great)

These elevate the demo from "cool features" to "coherent product vision."

| # | Feature | Why It's Should-Ship |
|---|---------|---------------------|
| F6 | Cross-Tab Synthesis | "It thinks for you" — comparison tables are very demo-able |
| F7 | Code Sandbox (Modal) | Unlocks "coding agent" use case — directly from assignment |
| F8 | Context-Aware Page Rewrite | "The web adapts to you" — high wow factor |

### Tier 3: Stretch (Makes Demo Exceptional)

These are impressive but the demo works without them.

| # | Feature | Why It's Stretch |
|---|---------|-----------------|
| F9 | Workflow Recorder + Replay | PostHog-style recording — complex, fragile |
| F10 | VLM Self-Healing Replay (Modal + Playwright) | Most technically ambitious — needs all other pieces working first |
| F11 | LFM2-VL Local Model | Huge differentiator but risky — WebGPU/ONNX may have issues |
| F12 | Predictive URL Suggestions | Nice-to-have, depends on history import quality |

### Future (Post-Challenge)

| Feature | Notes |
|---------|-------|
| Supabase sync layer | Cloud backup + multi-device |
| Settings UI for API keys | Replace `.env` with in-app config |
| Saved script library | Reusable sandbox scripts per domain |
| Workflow marketplace | Share/import workflows |

---

## 2. Weekly Milestones

### Week 1: Core Experience (Days 1-7)

**Goal:** A working browser where AI is embedded in the browsing experience. The core interaction loop works end-to-end.

```
Day 1 (Foundation)
├── Fix existing bugs: getTabHtml/getTabText, sidebar.d.ts (Day 0 fixes)
├── Install deps (rrweb, better-sqlite3, node-browser-history, zustand, modal)
├── Create tab preload script (src/preload/tab.ts) — IPC bridge for tabs
├── EventBus + InjectionRegistry + RrwebRingBuffer
├── AIEventLog + TabWorkspace + PageContext (shared utilities)
├── rrweb injection into tabs — events flowing via preload bridge
├── SQLite setup with StorageBackend interface
└── ModelRouter (cloud-only for now)

Day 2-3 (划词 + Ghost Text)
├── selection-pill.js — text selection → floating pill
├── Pill → Sidebar bridge — "Ask AI" opens sidebar with context
├── ghost-text.js — detect text fields, render ghost overlay
├── CompletionEngine — context assembly, cloud LLM query
├── Tab/Esc/Right-arrow interaction for ghost text
└── Test on: Gmail, Google Search, GitHub, Amazon

Day 4-5 (Attention System)
├── AttentionEngine — process rrweb mouse/scroll/dwell events
├── Intent classification (confused, comparing, interested)
├── page-annotations.js — render highlights/notes on page
├── Attention → Annotation pipeline with progressive disclosure
├── Anti-annoyance throttling
└── Tab-switch detection for "comparing" intent

Day 6-7 (History + Personalization)
├── HistoryImporter — read Chrome/Safari/Firefox SQLite
├── Profile builder — cluster URLs, extract patterns
├── OnboardingFlow.tsx — first-launch experience in sidebar
├── Feed profile into LLM context (system prompt)
├── URL completion boost from history data
└── 🎯 MILESTONE: End-to-end demo of Scenes 1, 2, 2.5, 3
```

**Week 1 Exit Criteria:**
- [ ] Select text → pill → sidebar with context works
- [ ] Type in any text field → ghost text appears → Tab accepts
- [ ] Dwell on content → subtle annotation appears
- [ ] First launch → history import → personalized greeting
- [ ] All features work on at least 3 target sites

---

### Week 2: Advanced Features + Polish (Days 8-14)

**Goal:** Add the features that make the demo exceptional, then polish everything for presentation.

```
Day 8 (Cross-Tab Synthesis)
├── TabSynthesizer — detect related tabs
├── Synthesis prompt — structured output (comparison table)
├── SynthesisView.tsx — render in sidebar
├── Sidebar view switching (chat ↔ synthesis)
└── 🎯 MILESTONE: Scene 4 (comparison demo) works

Day 9-10 (Code Sandbox)
├── SandboxManager — Modal API integration
├── Local fallback (WebContentsView sandbox)
├── DOM snapshot serialization
├── Chat → Sandbox detection and routing
├── SandboxResultView.tsx — output, code, "Apply" button
├── Script saving to SQLite
└── 🎯 MILESTONE: Scene 5 (data extraction demo) works

Day 10-11 (Page Rewrite)
├── Page type classifier (URL + content heuristics)
├── Rewrite strategies (article TL;DR, dashboard highlights)
├── page-rewriter.js injection
├── Original/AI View toggle
└── Test on: HN articles, API docs, Amazon product pages

Day 11-12 (Workflow Recording — if on track)
├── WorkflowRecorder — filter rrweb into action log
├── rrweb Replayer integration in sidebar
├── AI summarization of recorded steps
├── "Make it replayable" → save to SQLite
└── 🎯 MILESTONE: Scene 6 (record + replay demo) works

Day 12-13 (Local Model — if on track)
├── LocalModelManager — hidden WebContentsView + LFM2-VL ONNX
├── Inference IPC
├── ModelRouter: route fast tasks to local
├── Ghost text speedup (local model path)
└── Quick explain from 划词 (local, instant)

Day 13-14 (Polish + Demo Prep)
├── Demo script rehearsal — all scenes
├── Fix edge cases from rehearsal
├── Dark mode consistency across all injected UI
├── Error handling — graceful degradation
├── Performance tuning
├── README update with feature descriptions
└── 🎯 MILESTONE: Full demo runs smooth, ready to present
```

**Week 2 Exit Criteria:**
- [ ] Cross-tab synthesis works with 3+ similar tabs
- [ ] Sandbox executes AI-generated scripts, shows results
- [ ] At least one page rewrite strategy works well
- [ ] (Stretch) Workflow recorder captures and replays
- [ ] (Stretch) Local model reduces ghost text latency
- [ ] Full demo runs start-to-finish without errors

---

## 3. Daily Decision Points

Built-in checkpoints to prevent scope creep and catch problems early.

| Day | Check | If Behind |
|-----|-------|-----------|
| Day 1 EOD | rrweb events flowing? Tab preload bridge working? SQLite working? | Debug infra — don't move to features |
| Day 3 EOD | 划词 + ghost text working on 3 sites? | Simplify ghost text (URL bar only), prioritize 划词 |
| Day 5 EOD | Attention annotations showing? | Reduce to just highlights (drop margin notes + pointer) |
| Day 7 EOD | **Week 1 milestone met?** | **Cut Tier 3 entirely. Focus Week 2 on Tier 2 + polish** |
| Day 10 EOD | Sandbox + synthesis working? | Cut page rewrite, move to polish |
| Day 12 EOD | Workflow recorder working? | Skip it — polish existing features |
| Day 13 EOD | Demo runs clean? | Day 14 = fix-only, no new features |

---

## 4. Risk-Adjusted Timeline

Realistic estimates accounting for things going wrong:

```
                    Optimistic    Realistic    Pessimistic
                    (all works)   (some snags)  (major issues)

Foundation          0.5 day       1 day         1.5 days
划词 + Ghost Text    1.5 days      2.5 days      3.5 days
Attention System    1.5 days      2 days        3 days
History Import      0.5 day       1 day         1.5 days
Cross-Tab Synthesis 1 day         1.5 days      2 days
Code Sandbox        1 day         2 days        3 days
Page Rewrite        1 day         1.5 days      2.5 days
Workflow Recorder   1.5 days      2.5 days      4 days
Local Model         1 day         2 days        3 days
Polish + Demo       1 day         2 days        2 days
                    ─────────     ─────────     ─────────
Total:              10.5 days     18 days       26 days

Available:          14 days
Buffer:             3.5 days      -4 days       -12 days
```

**Translation:**
- Optimistic: Ship everything including stretch goals
- Realistic: Ship Tier 1 + Tier 2, maybe one Tier 3 feature
- Pessimistic: Ship Tier 1 only, but polished

**The cut line is clear:** If Week 1 milestone is met, proceed to Tier 2. If not, use Week 2 for fixing + polishing Tier 1.

---

## 5. Feature Dependency Map

What blocks what — helpful for deciding what to work on next if something is stuck.

```
Nothing depends on ──────────────────────────────────────┐
these (safe to cut):                                     │
                                                         │
    F11 (Local Model) ──── standalone, enhances F2, F3   │
    F12 (URL Predictions) ── depends on F5 only          │
    F9 (Workflow Recorder) ── depends on rrweb only      │
    F10 (VLM Replay) ──── depends on F7 (Modal) + F9    │
                                                         │
Everything depends on ───────────────────────────────────┤
these (must work):                                       │
                                                         │
    Tab preload bridge ─→ ALL (rrweb, pill, ghost text)  │
    rrweb integration ──→ F3, F9, F2 (form data)        │
    InjectionRegistry ──→ F1, F2, F3, F4, F8            │
    EventBus ───────────→ F3, F2, F9                     │
    AIEventLog ─────────→ F3, F4, F7 (trust/debugging)  │
    TabWorkspace ───────→ F3, F6 (enriched tab model)   │
    PageContext ────────→ F2, F6, F7, F8 (shared util)  │
    ModelRouter ────────→ F2, F6, F7, F8                 │
    SQLite + Backend ───→ F5, F7, F9                     │
                                                         │
Independent (can parallelize): ──────────────────────────┘
    F1 (划词) ←→ F2 (Ghost Text)     — no dependency
    F3 (Attention) ←→ F5 (History)   — no dependency
    F6 (Synthesis) ←→ F7 (Sandbox)   — no dependency
```

---

## 6. Demo Preparation Checklist

Start preparing demo content from Day 10, not Day 14.

### Demo Environment Setup
- [ ] Prepare 3 GPU provider tabs (Lambda, RunPod, Vast.ai) for cross-tab demo
- [ ] Find a good technical blog post for 划词 + attention demo
- [ ] Set up a Gmail draft for ghost text demo
- [ ] Find an e-commerce page for sandbox data extraction demo
- [ ] Set up a simple dashboard with export flow for workflow demo
- [ ] Ensure all demo sites work with rrweb injection (no CSP blocks)

### Demo Script
- [ ] Write exact sequence of actions for each scene
- [ ] Time each scene — total should be under 3 minutes
- [ ] Identify "if this fails" backup for each scene
- [ ] Record a backup video in case live demo has issues

### Technical Prep
- [ ] Ensure Modal API key is set and working
- [ ] Verify OpenAI/Anthropic API keys have sufficient quota
- [ ] Test on a clean machine (no cached state)
- [ ] Have browser history import data ready (pre-populated if needed)

---

## 7. What Success Looks Like

### Minimum Viable Demo (Tier 1 only — good)
> "A browser where you can select text and get AI help, where ghost text predicts what you'll type next, and where the AI highlights what matters on the page — all personalized from your browsing history."

### Target Demo (Tier 1 + 2 — great)
> "All of the above, plus: it detects when you're comparing things across tabs and builds a summary. You can ask it to extract data from any page and it runs code in a cloud sandbox. It can simplify complex pages into what you actually need."

### Stretch Demo (All tiers — exceptional)
> "All of the above, plus: it records your workflows and replays them with AI handling any changes. It runs a vision model locally in the browser for instant understanding. The AI uses Playwright + VLM to self-heal broken automations."

---

## 8. Demo Narrative (Strawberry-Informed Framing)

When presenting, lead with architecture awareness, not just features:

> "I analyzed Strawberry's architecture and identified 6 layers: browser shell, agent runtime, page interaction, native bridge, data/memory, and trust/safety. For the Blueberry challenge, I focused on the layers that create the most visible differentiation — **page interaction** and **agent sensing** — while building foundations (EventBus, StorageBackend, ModelRouter, AIEventLog) that show these aren't hacks, they're designed to scale into the full 6-layer stack."

**Key points to hit:**
- **"Tab as execution unit, not just UI container"** — each tab has an event stream, attention profile, and context summary
- **"Sense → Think → Act loop"** — every feature maps to perception-cognition-action
- **"Dual-model architecture"** — local VLM for instant, cloud for deep (nobody else does this)
- **"Event-sourced design"** — every AI action is logged, debuggable, reversible
- **"Trust spectrum"** — passive to autonomous, with approval gates at the right points
- **"Privacy-first"** — browsing data never leaves the device

---

## 9. Post-Challenge Roadmap (Future Vision)

If Blueberry impresses and becomes a real product:

```
v0.1 (Challenge)    → Core AI co-pilot experience
v0.2 (Month 1)      → Supabase sync, settings UI, saved script library
v0.3 (Month 2)      → Workflow marketplace, multi-language sandbox
v0.4 (Month 3)      → Team features (shared workflows, shared annotations)
v1.0 (Month 6)      → Public beta: "The AI browser for power users"
```

| Future Feature | Why |
|---------------|-----|
| Supabase sync layer | Multi-device, cloud backup |
| In-app settings UI | Replace `.env` with proper config |
| Saved script library per domain | "I always extract prices from Amazon" |
| Workflow sharing/marketplace | Community-built automations |
| Team annotations | Shared highlights on internal docs |
| Plugin system | Third-party injected scripts |
| Mobile companion | View saved data, trigger workflows from phone |

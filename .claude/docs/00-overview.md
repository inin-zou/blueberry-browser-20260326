# Blueberry AI Co-Pilot: Overview

> **"The first browser with an AI that runs locally, sees what you see, and helps before you ask."**

**Date:** 2026-03-26

---

## Document Index

| Doc | Purpose |
|-----|---------|
| [01-product-design.md](./01-product-design.md) | Vision, features, UX flows, demo narrative |
| [02-architecture.md](./02-architecture.md) | System design, data models, design patterns, reuse strategy |
| [03-implementation-plan.md](./03-implementation-plan.md) | Prioritized build plan, dependencies, timeline |
| [04-roadmap.md](./04-roadmap.md) | Scope tiers, weekly milestones, cut lines, demo prep |
| [05-review-fixes.md](./05-review-fixes.md) | Critical issues found in code review, resolutions, priority order |
| [06-design-guide.md](./06-design-guide.md) | Liquid Monolith palette, design tokens, component patterns, Stitch draft audit |
| [07-design-philosophy.md](./07-design-philosophy.md) | 6-layer architecture mapping, 5 tradeoffs, trust model, event-sourced design |
| [08-agentic-engineering.md](./08-agentic-engineering.md) | Testing protocol, pattern review, code quality gates, definition of done |
| [09-phase0-foundation-plan.md](./09-phase0-foundation-plan.md) | Phase 0 implementation plan — TDD, bite-sized tasks, exact code |

---

## One-Liner Per Feature

| # | Feature | Description |
|---|---------|-------------|
| 1 | Attention-Aware Co-Pilot | Track mouse/scroll/dwell to detect intent, assist proactively |
| 2 | Auto-Completion (Ghost Text) | Cursor-style Tab completion in any text field, context-aware |
| 3 | 划词 → Pill → Sidebar | Select text → floating action pill → sidebar deep dive |
| 4 | Agent Visual Presence | Highlights, annotations, pointer on page — AI shows what it sees |
| 5 | Context-Aware Page Rewrite | Restructure/simplify page content based on user context |
| 6 | Cross-Tab Synthesis | Detect related tabs, generate comparison tables and summaries |
| 7 | Workflow Recorder & Replay | PostHog-style recording + AI-powered replayable automations |
| 8 | Browser History Import | Cold-start personalization from Chrome/Firefox/Safari history |
| 9 | Code Sandbox | Isolated execution environment for AI-generated scripts on pages |

## Five Technical Pillars

```
1. rrweb           — Behavioral data spine (mouse, scroll, clicks, DOM mutations)
2. LFM2-VL        — Local vision-language model (WebGPU, in-browser, ~100ms)
3. Cloud LLM      — Deep reasoning (GPT-4o / Claude, 1-3s)
4. JS Injection   — UI manipulation on any page (existing runJs())
5. Code Sandbox   — Modal (cloud) for heavy/multi-language, local fallback for simple JS
```

## Tech Stack Decisions

| Area | Choice | Notes |
|------|--------|-------|
| Sandbox | Modal (cloud containers) | Existing experience, multi-language support |
| Database | SQLite (local-first) | Supabase sync layer as future plan |
| Cloud LLM | OpenAI + Anthropic via Vercel AI SDK | Keep current dual-provider setup |
| Local Model | ONNX Runtime Web + WebGPU (LFM2-VL) | Same as Liquid AI's demo |
| Recording | rrweb + custom replay UI | rrweb records, custom sidebar replay |
| State Mgmt | Keep React Context + Zustand for new | No refactor, gradual adoption |
| Injected UI | TBD (ui-ux-pro-max skill) | Design decision deferred |
| Script Bundling | Separate TS files + esbuild | Proper IDE support |
| Workflow Replay | Modal + Playwright + cloud VLM | Self-healing selectors, visual verification |
| API Keys | `.env` file | Keep simple |

## Design Philosophy: Privacy-First, Local-First

All browsing data (attention signals, history, rrweb events) stays on-device. Cloud is only used for deliberate user actions (chat, synthesis, sandbox execution). This is a competitive differentiator — Atlas/Dia/Comet all send data to the cloud.

## Key Differentiator

No existing AI browser does real-time, attention-aware, proactive co-browsing with a dual local+cloud model architecture. Atlas/Dia/Comet all either wait for you to ask or take over completely. Blueberry fills the middle ground.

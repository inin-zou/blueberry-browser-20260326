# Agentic Engineering: Quality & Testing Protocol

**Date:** 2026-03-26
**Purpose:** Ensure every implementation step produces tested, maintainable, pattern-consistent code.

---

## 1. Core Principle

**Every step is: Implement → Test → Review Patterns → Move On.**

Never move to the next task with untested code. Never finish a major feature without checking for shared patterns. Code quality compounds — shortcuts in Phase 0 become refactors in Phase 2.

---

## 2. Per-Step Protocol

After completing **each implementation task** (each row in `03-implementation-plan.md`):

### Step 1: Write Unit Tests

```
Task completed (e.g., "Create EventBus")
    │
    ▼
Write unit tests covering:
    ├── Happy path — does it do what it should?
    ├── Edge cases — empty input, null, max size, rapid fire
    ├── Error handling — what happens when things fail?
    └── Integration — does it work with adjacent components?
    │
    ▼
Run tests → all pass
    │
    ▼
Move to next task
```

**Test file naming:** `src/main/__tests__/EventBus.test.ts` (mirror source structure)

**What to test per component type:**

| Component Type | Test Focus |
|---------------|------------|
| **Engine** (AttentionEngine, CompletionEngine) | Input signals → correct output events. Threshold logic. Throttling/debounce behavior. |
| **Data structure** (RrwebRingBuffer, AIEventLog) | Push/pop, capacity limits, eviction, query by time range. |
| **IPC bridge** (tab preload, EventManager) | Message format validation, channel whitelist, unauthorized channel rejection. |
| **Injected script** (ghost-text, selection-pill) | DOM manipulation correctness. Test in JSDOM or Playwright against a test page. |
| **Manager** (SandboxManager, ModelRouter) | Routing logic, fallback behavior, timeout handling, error propagation. |
| **Storage** (StorageBackend, SqliteBackend) | CRUD operations, query correctness, migration safety. |
| **UI component** (SynthesisView, ReplayPlayer) | Renders without crash, displays correct data, handles empty/loading/error states. |

### Step 2: Verify Against Architecture

Quick mental check after each task:

- [ ] Does this follow the EventBus pattern (producers → bus → consumers)?
- [ ] Does this use PageContext/TabWorkspace instead of re-extracting page data?
- [ ] Does this log to AIEventLog where appropriate?
- [ ] Does this respect the hot path/cold path split?
- [ ] Are IPC channels whitelisted in the tab preload?
- [ ] Is the injected UI using Shadow DOM?

---

## 3. Post-Feature Pattern Review

After completing **each major feature** (each Phase in `03-implementation-plan.md`):

### Pattern Review Checklist

```
Phase completed (e.g., "Phase 1: Core Interactions")
    │
    ▼
Review all code written in this phase:
    │
    ├── 1. SHARED PATTERNS
    │   ├── Are there 2+ components doing the same thing differently?
    │   ├── Can any duplicated logic be extracted into a shared utility?
    │   ├── Is PageContext.ts being used consistently, or did someone inline it?
    │   └── Are error handling patterns consistent across engines?
    │
    ├── 2. INTERFACE CONSISTENCY
    │   ├── Do all engines accept/return the same types (TabSummary, PageContext)?
    │   ├── Are IPC channel names following the convention (domain:action)?
    │   ├── Do all injected scripts use createBlueberryElement() for Shadow DOM?
    │   └── Are event names consistent (past tense for events: 'tab:switched', 'attention:detected')?
    │
    ├── 3. CODE QUALITY
    │   ├── Are files under 300 lines? (If over, split by responsibility)
    │   ├── Are there any TODO/HACK/FIXME that should be resolved?
    │   ├── Is TypeScript strict (no `any` leaks, no `as` casts without reason)?
    │   └── Are imports clean (no circular dependencies)?
    │
    ├── 4. TEST COVERAGE
    │   ├── Does every engine have at least 3 test cases?
    │   ├── Does every data structure have boundary tests?
    │   ├── Is there at least one integration test per IPC flow?
    │   └── Are injected scripts tested against a real page (Playwright)?
    │
    └── 5. ARCHITECTURE ALIGNMENT
        ├── Does the implementation match 02-architecture.md data models?
        ├── Are tab IDs consistently strings (Fix 2)?
        ├── Is StorageBackend used (not direct SQLite calls)?
        └── Does the trust spectrum hold (no auto-actions where approval is needed)?
```

### When to Refactor

- **Immediately:** If you find 3+ places doing the same thing → extract now
- **Immediately:** If a file exceeds 400 lines → split now
- **Immediately:** If TypeScript catches a type mismatch with architecture docs → fix now
- **Defer:** If you see a "nice to have" improvement that isn't blocking → add to polish phase
- **Never:** Don't refactor working code just because it's "not elegant enough" — ship first

---

## 4. Testing Infrastructure

### Setup (Phase 0, Day 1)

```bash
# Install test dependencies
pnpm add -D vitest @testing-library/react jsdom @playwright/test
```

**Vitest config** (add to `vitest.config.ts`):

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',          // for main process tests
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/__tests__/**'],
    },
  },
})
```

### Test Categories

| Category | Tool | Location | When to Run |
|----------|------|----------|-------------|
| **Unit tests** | Vitest | `src/main/__tests__/` | After each task |
| **Component tests** | Vitest + Testing Library | `src/renderer/**/__tests__/` | After UI component changes |
| **Injected script tests** | Playwright | `tests/injected/` | After any injected script change |
| **Integration tests** | Vitest | `src/main/__tests__/integration/` | After each phase |
| **E2E demo tests** | Playwright | `tests/e2e/` | Day 13-14 (polish phase) |

### Running Tests

```bash
# Run all unit tests
pnpm test

# Run specific test file
pnpm test EventBus

# Run with coverage
pnpm test --coverage

# Run injected script tests (requires Playwright)
pnpm test:injected

# Run E2E demo flow
pnpm test:e2e
```

---

## 5. Per-Phase Test Plan

### Phase 0: Foundation

| File | Tests Required |
|------|---------------|
| `EventBus.ts` | subscribe/unsubscribe, emit to multiple consumers, emit with no subscribers, event type filtering |
| `RrwebRingBuffer.ts` | push within capacity, eviction when full, getRange by time, getRecent by minutes, size estimation |
| `AIEventLog.ts` | log event, cap at 1000, query by tab, query by type, accept rate calculation |
| `TabWorkspace.ts` | create from Tab, update attention profile, update context summary |
| `PageContext.ts` | buildPageContext returns correct shape, getAllTabContexts handles empty/multiple tabs |
| `ModelRouter.ts` | routes fast tasks to local (when available), routes normal tasks to cloud, fallback when local unavailable |
| `StorageBackend.ts` | CRUD for workflows, scripts, profile, URLs. Query by prefix. Delete. |
| `db.ts` | Tables created on init, migrations run, concurrent access safe |
| `InjectionRegistry.ts` | Register script, inject all into tab, dependency order respected, re-inject on navigation |

### Phase 1: Core Interactions

| Feature | Tests Required |
|---------|---------------|
| Selection pill | Appears on text selection, positions correctly, dismisses on click-away, dismisses after 5s, "Ask AI" sends correct IPC |
| Ghost text | Detects input/textarea/contenteditable, renders overlay at correct position, Tab accepts, Esc dismisses, debounce works |
| CompletionEngine | Assembles context correctly, queries LLM, returns result, handles timeout, handles empty response |
| Sidebar pre-fill | Receives selection context, displays source text, sends to LLM with context |

### Phase 2: Attention System

| Feature | Tests Required |
|---------|---------------|
| AttentionEngine | Dwell detection (2s threshold), scroll velocity classification, scroll-back detection, tab-switch counting |
| Intent classification | confused = dwell + scroll-back, comparing = rapid tab switch, interested = slow scroll |
| Annotations | Render on correct element, progressive disclosure (3 ignored → throttle), dismiss on Esc |
| AIEventLog integration | Every annotation logged, disposition tracked (accepted/dismissed) |

### Phase 3: Browser History & Personalization

| Feature | Tests Required |
|---------|---------------|
| HistoryImporter | Reads Chrome/Safari SQLite, handles locked DB (copy first), handles missing browser |
| Profile builder | Clusters URLs by domain, extracts topic patterns, generates UserProfile |
| Onboarding UI | Renders browser options, shows progress, handles skip |
| URL completion boost | History URLs fed into CompletionEngine, prefix search works |

### Phase 4: Cross-Tab Synthesis

| Feature | Tests Required |
|---------|---------------|
| TabSynthesizer | Detects 3+ tab switches in 60s, extracts content from multiple tabs |
| Synthesis prompt | Sends multi-tab content to LLM, receives structured comparison |
| SynthesisView | Renders comparison table, links back to source tabs, handles empty data |
| Sidebar view switching | Chat ↔ synthesis toggle, state preserved |

### Phase 5: Page Rewriting

| Feature | Tests Required |
|---------|---------------|
| Page type classifier | Detects article/docs/product/dashboard from URL + content |
| Rewrite strategies | Article → TL;DR, dashboard → highlight anomalies |
| page-rewriter.js | Injects rewrite, toggle original/AI view, doesn't break forms |

### Phase 5.5: Code Sandbox

| Feature | Tests Required |
|---------|---------------|
| SandboxManager | Modal API call succeeds, timeout enforced, local fallback works |
| DOM snapshot | Serializes current tab HTML, truncates oversized DOMs |
| Chat → Sandbox | Detects code request in chat, routes to sandbox |
| SandboxResultView | Renders output, shows code, "Apply" button works |

### Phase 6: Workflow Recording & Replay

| Feature | Tests Required |
|---------|---------------|
| WorkflowRecorder | Filters rrweb events into action log, correct step sequencing |
| rrweb Replayer | Plays back recording in sidebar, timeline controls work |
| AI summarization | Generates step descriptions from action log |
| Workflow save/load | Saves to SQLite via StorageBackend, loads correctly |

### Phase 7: Local Model (Stretch)

| Feature | Tests Required |
|---------|---------------|
| LocalModelManager | Creates hidden WebContentsView, loads ONNX model |
| Inference IPC | Request → result round-trip works, timeout handled |
| ModelRouter local path | Fast tasks route to local, confidence fallback works |

### Phase 8: Polish & Demo

| Focus | Verification |
|-------|-------------|
| Demo rehearsal | All 6 scenes run without errors |
| Edge cases | Graceful degradation when model fails, page blocks injection |
| Dark mode | All injected UI respects dark/light mode |
| Performance | Ghost text <200ms, annotations <100ms, no UI jank |

---

## 6. Execution Speed Protocol (Accelerated Sprint)

When running all phases in a single session with Claude Code:

### Parallelization Rules

```
Independent tasks → dispatch in parallel (max 4 subagents)
Sequential tasks → dispatch one at a time
After each parallel batch → run ALL tests before proceeding
After each phase → code review subagent
```

### Phase Execution Order (Optimized)

```
Phase 0: Foundation ✅ (DONE)
    │
    ├─→ Phase 1a: 划词 selection pill     ┐
    ├─→ Phase 1b: Ghost text              ├─ PARALLEL (different files)
    └─→ Phase 2a: Attention Engine        ┘
         │
         ▼
    Phase 2b: Annotations + progressive disclosure (depends on 2a)
         │
         ├─→ Phase 3: History import      ┐
         └─→ Phase 4: Cross-tab synthesis ├─ PARALLEL
              │                            ┘
              ▼
         Phase 5: Page rewrite
              │
              ▼
         Phase 5.5: Sandbox (Modal)
              │
              ▼
         Phase 6: Workflow recorder
              │
              ▼
         Phase 7: Local model (stretch)
              │
              ▼
         Phase 8: Polish + demo prep
```

### Skip Criteria (Time Pressure)

If running behind schedule:
- **Phase 7 (Local Model):** Skip entirely — cloud-only works fine
- **Phase 6 (Workflow):** Skip replay execution — keep recording + visual replay only
- **Phase 5 (Page Rewrite):** Reduce to one strategy (article TL;DR only)
- **Phase 5.5 (Sandbox):** Keep local fallback only, skip Modal integration

### Quality Gates (Non-Negotiable Even Under Time Pressure)

These are NEVER skipped regardless of pace:
1. Unit tests for every new module
2. `pnpm test` passes after every parallel batch
3. No `any` in public interfaces without explicit justification
4. Every AI output goes through AIEventLog
5. Every injected UI uses Shadow DOM (from design guide)

---

## 7. Code Review Protocol

After each phase, use the `superpowers:requesting-code-review` skill or manually check:

### Self-Review Checklist

```markdown
## Code Review: Phase [N]

### Files Changed
- [ ] List all new/modified files

### Architecture Compliance
- [ ] Data models match 02-architecture.md
- [ ] IPC channels match channel map
- [ ] Trust spectrum respected (no unauthorized auto-actions)
- [ ] StorageBackend used for all persistence
- [ ] AIEventLog used for all AI outputs

### Code Quality
- [ ] No files > 300 lines
- [ ] No `any` types without justification
- [ ] No circular imports
- [ ] Error handling on all async operations
- [ ] No hardcoded values (use design tokens from 06-design-guide.md)

### Tests
- [ ] All new code has tests
- [ ] All tests pass
- [ ] Edge cases covered (empty, null, timeout, rapid fire)

### Shared Patterns Identified
- [ ] List any duplicated logic found
- [ ] List any extractions performed
- [ ] List any patterns that should be documented
```

---

## 8. Naming Conventions

Keep consistent across the codebase:

| Category | Convention | Example |
|----------|-----------|---------|
| Files (main process) | PascalCase | `EventBus.ts`, `AttentionEngine.ts` |
| Files (injected scripts) | kebab-case | `ghost-text.ts`, `selection-pill.ts` |
| Files (tests) | match source + `.test` | `EventBus.test.ts` |
| IPC channels | `domain:action` | `rrweb:event`, `completion:request` |
| Events (past tense) | `domain:past-verb` | `tab:switched`, `attention:detected` |
| CSS classes (injected) | `blueberry-` prefix | `blueberry-pill`, `blueberry-ghost` |
| Types/Interfaces | PascalCase | `AttentionSignal`, `CompletionContext` |
| Functions | camelCase | `buildPageContext`, `getAllTabContexts` |
| Constants | UPPER_SNAKE | `MAX_RING_BUFFER_SIZE`, `DWELL_THRESHOLD_MS` |

---

## 9. Definition of Done

A task is **done** when:

1. Implementation complete and working
2. Unit tests written and passing
3. TypeScript compiles with no errors
4. Code follows naming conventions
5. Architecture docs still accurate (update if implementation diverged)
6. AIEventLog integration verified (where applicable)
7. No regressions in existing tests

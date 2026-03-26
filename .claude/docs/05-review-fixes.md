# Review Fixes: Issues Found & Resolutions

**Date:** 2026-03-26
**Context:** Code review of design docs against actual codebase surfaced critical gaps.

---

## Critical Fixes (Must resolve before Day 1 coding)

### Fix 1: Tab-to-Main IPC Bridge (C3 + C2 + I1 + I6)

**Problem:** The entire architecture assumes injected scripts can send IPC to the main process. But `Tab.ts` creates WebContentsViews with **no preload script** — injected code has zero access to `ipcRenderer`. This breaks: rrweb events, completion requests, selection actions, and every `tab → main` IPC channel.

Additionally, `executeJavaScript` runs after page load (`document-idle`), not `document-start`. rrweb needs early injection to capture the initial DOM snapshot.

**Resolution: Add a tab preload script.**

```
New file: src/preload/tab.ts
```

This preload bridges `window.postMessage` ↔ `ipcRenderer`:

```typescript
// src/preload/tab.ts
import { contextBridge, ipcRenderer } from 'electron'

// Expose a bridge API to the injected page scripts
contextBridge.exposeInMainWorld('blueberry', {
  // Injected scripts call this to send events to main process
  send: (channel: string, data: any) => {
    const allowedChannels = [
      'rrweb:event',
      'attention:signal',
      'completion:request',
      'selection:action',
    ]
    if (allowedChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },

  // Main process can push messages to the tab
  on: (channel: string, callback: (...args: any[]) => void) => {
    const allowedChannels = [
      'completion:response',
      'attention:signal',
      'page:rewrite',
      'page:restore',
    ]
    if (allowedChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  }
})
```

**Changes to Tab.ts:**

```typescript
// Add preload to WebContentsView
this.webContentsView = new WebContentsView({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    preload: join(__dirname, '../preload/tab.js'),  // ADD THIS
  },
})
```

**For early injection (rrweb):** Use `webContents.on('dom-ready')` instead of `did-finish-load`. This fires earlier than `document-idle`. For capturing the initial DOM state, rrweb's `record()` function handles late attachment — it takes a full snapshot when it starts, then records incremental mutations. This is acceptable; we don't need `document-start`.

**Injected scripts communicate via:**
```javascript
// Inside injected script (e.g., rrweb-capture.js)
window.blueberry.send('rrweb:event', event)

// Inside injected script (e.g., ghost-text.js) — receiving
window.blueberry.on('completion:response', (result) => { ... })
```

**Add to preload build config:** `electron.vite.config.ts` needs a new entry for `tab.ts` preload, alongside existing `sidebar.ts` and `topbar.ts`.

---

### Fix 2: Tab ID Type Mismatch (C4)

**Problem:** `Window.ts` uses string tab IDs (`"tab-1"`, `"tab-2"`). All architecture data models use `number`.

**Resolution:** Update all data models in `02-architecture.md` to use `string` for tab IDs, matching the existing codebase. Do NOT change the codebase — it's working and the renderers already use string IDs.

**Affected interfaces:**
- `AttentionSignal.tabId` → `string`
- `CompletionContext` references → `string`
- `SandboxRequest.sourceTabId` → `string`
- `WorkflowRecording.tabId` → `string`
- `TabSummary.id` → `string`
- `TabContext.tabId` → `string`
- `PageContext.tabId` → `string`
- `SandboxExecution.sourceTabId` → `string`
- All IPC payloads with `tabId` → `string`

---

### Fix 3: Broken `getTabHtml()` and `getTabText()` (C5)

**Problem:** These methods use `return` inside `executeJavaScript`, which is invalid.

**Resolution:** Remove the `return` keyword:

```typescript
// Tab.ts — fix these two methods
async getTabHtml(): Promise<string> {
  return await this.runJs("document.documentElement.outerHTML");
}

async getTabText(): Promise<string> {
  return await this.runJs("document.documentElement.innerText");
}
```

**This is a Day 0 fix** — do it before any feature work begins.

---

### Fix 4: Sandbox Architecture Alignment (C1)

**Problem:** `01-product-design.md` describes sandbox as local WebContentsView. `02-architecture.md` describes it as Modal (cloud). The timeout values differ (10s vs 30s). The product doc doesn't mention multi-language support, but the architecture's `SandboxRequest.language` field supports Python/TypeScript.

**Resolution:** Update `01-product-design.md` section 2.9 to align with the architecture doc:

- Primary: **Modal** (cloud containers) — multi-language, full isolation
- Fallback: **Local WebContentsView** — JS-only, offline, simpler
- Timeout: **30s for Modal**, **10s for local fallback**
- Multi-language: Python + TypeScript + JavaScript via Modal
- Local fallback is JS-only

Update the product doc's "Architecture" subsection and "Safety controls" to match.

---

### Fix 5: sidebar.d.ts Out of Sync (C6)

**Problem:** The type declaration file is missing methods that `sidebar.ts` implements and `ChatContext.tsx` calls.

**Resolution:** Update `sidebar.d.ts` to match `sidebar.ts`. Add missing methods: `clearChat`, `getMessages`, `onMessagesUpdated`, `removeMessagesUpdatedListener`. Fix `sendChatMessage` parameter type to `Partial<ChatRequest>`.

**This is a Day 0 fix.**

---

## Important Fixes (Resolve during Phase 0-1)

### Fix 6: EventManager.cleanup() Wipes All IPC (I2)

**Problem:** `EventManager.cleanup()` calls `ipcMain.removeAllListeners()` with no channel filter, removing every handler in the process.

**Resolution:** Track registered channels and only remove what was registered:

```typescript
class EventManager {
  private registeredChannels: string[] = []

  private registerHandler(channel: string, handler: Function) {
    ipcMain.on(channel, handler)
    this.registeredChannels.push(channel)
  }

  cleanup() {
    for (const channel of this.registeredChannels) {
      ipcMain.removeAllListeners(channel)
    }
    this.registeredChannels = []
  }
}
```

---

### Fix 7: Ghost Text Rendering Technique (I7)

**Problem:** No implementation detail for how ghost text is rendered in arbitrary text fields.

**Resolution — the "mirror div" technique:**

For `<input>` and `<textarea>`:
1. Create a hidden "mirror" div that matches the input's font, size, padding
2. Copy the input's text into the mirror up to cursor position
3. Read the mirror's dimensions to get cursor pixel coordinates
4. Position the ghost text `<span>` at those coordinates
5. Ghost span uses `pointer-events: none`, same font, dimmed opacity

For `contenteditable`:
1. Use `window.getSelection().getRangeAt(0).getBoundingClientRect()` to get cursor position
2. Position ghost text span at those coordinates

For URL bar (TopBar's own input):
- This is inside our own React app, not an injected script
- Can use a simpler approach: controlled component with a secondary styled span

**Add to `02-architecture.md` section on ghost text, and reference in `03-implementation-plan.md` task 1.4.**

---

### Fix 8: Shared Utility File Location (I4)

**Problem:** `buildPageContext()` and `getAllTabContexts()` are specified as shared utilities used by 4+ engines, but no file is assigned.

**Resolution:** Create `src/main/PageContext.ts` as the canonical home:

```
src/main/PageContext.ts
  - buildPageContext(tab: Tab): Promise<PageContext>
  - getAllTabContexts(window: Window): Promise<TabContext[]>
  - Refactor LLMClient.ts to use these instead of inline logic
```

Add to Phase 0 file creation order in `03-implementation-plan.md`.

---

### Fix 9: better-sqlite3 Native Module Build (I8)

**Problem:** `better-sqlite3` requires native module rebuild for Electron, but no build config is specified.

**Resolution:** Use `electron-rebuild` as a postinstall script:

```json
// package.json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3"
  }
}
```

Also add to `electron-builder.yml`:
```yaml
npmRebuild: true
```

**Alternative if rebuild is problematic:** Use `sql.js` (SQLite compiled to WASM) instead. No native module needed, works everywhere. Slightly slower than `better-sqlite3` but zero build issues. Decision to make on Day 1.

---

### Fix 10: Cross-Tab Content Extraction (I5)

**Problem:** Extracting content from background (non-active) tabs is unspecified.

**Resolution:** `executeJavaScript` works on any `WebContentsView`, not just the visible one. The key is that the tab's page must be loaded. Electron doesn't unload background tabs (unlike Chrome's tab discarding).

```typescript
// In TabSynthesizer
async function extractTabContent(tab: Tab): Promise<string> {
  // executeJavaScript works on background tabs
  return await tab.getTabText()
}

async function extractMultipleTabs(tabs: Tab[]): Promise<TabContent[]> {
  // Parallel extraction from all tabs
  return Promise.all(tabs.map(async tab => ({
    id: tab.id,
    url: tab.url,
    title: tab.title,
    content: await extractTabContent(tab)
  })))
}
```

Add to `02-architecture.md` TabSynthesizer section.

---

### Fix 11: Tab-Switch Detection (I10)

**Problem:** `BrowserContext.tsx` polls every 2s, too slow for detecting rapid tab switches.

**Resolution:** Add push-based tab activation event. In `EventManager.ts`, when `switchTab` is called, emit an event:

```typescript
// In EventManager, on switchTab handler:
ipcMain.on('switch-tab', (event, tabId) => {
  this.window.switchTab(tabId)
  // Emit to AttentionEngine
  this.eventBus.emit('tab:switched', {
    tabId,
    timestamp: Date.now()
  })
})
```

AttentionEngine listens for `tab:switched` events, not BrowserContext polling.

---

### Fix 12: Sidebar Onboarding State (I3)

**Problem:** The sidebar state machine diagram doesn't show how onboarding is reached or exited clearly.

**Resolution:** Onboarding is a special state triggered on first launch, not from other views:

```
App startup
    │
    ├─→ First launch? → SidebarView = 'onboarding'
    │                         │
    │                    user completes/skips
    │                         │
    │                         ▼
    └─→ Not first launch → SidebarView = 'chat' (default)
```

Add `isFirstLaunch` check to `SideBar.ts` init logic. Add `onboardingData` to `SidebarState`.

---

## Minor Fixes

### Fix 13: RrwebRingBuffer Initialization (M1)
Add `= []` initializer: `private buffer: RrwebEvent[] = []`

### Fix 14: Tab Bounds on Creation (M4)
`Window.ts` `createTab()` should call `updateTabBounds()` after adding the tab, not hardcode sidebar width.

### Fix 15: Injected UI Styling Decision (M5)
**Decision (make now, not later):** Use **Shadow DOM** for all injected UI elements (pill, ghost text, annotations). This provides full CSS isolation from host page styles. Each injected element creates a shadow root with scoped styles inside.

```javascript
// Example: selection pill injection
const host = document.createElement('div')
host.id = 'blueberry-selection-pill'
const shadow = host.attachShadow({ mode: 'closed' })
shadow.innerHTML = `
  <style>
    .pill { /* fully scoped styles, no conflicts */ }
  </style>
  <div class="pill">...</div>
`
document.body.appendChild(host)
```

This resolves z-index issues (shadow DOM creates a new stacking context) and dark/light mode (detect host page background, apply appropriate theme).

### Fix 16: SessionStore Missing Definition (I9)
`SessionStore` appears in the system diagram but has no definition. Resolution: it IS the `StorageBackend` — rename in the diagram to `StorageBackend (SqliteBackend)` to avoid confusion. Remove `SessionStore` as a separate concept.

---

## Implementation Priority

Apply these fixes in this order:

| Priority | Fix | When |
|----------|-----|------|
| **Day 0** | Fix 3 (getTabHtml bug) | Before any feature work |
| **Day 0** | Fix 5 (sidebar.d.ts) | Before any feature work |
| **Phase 0** | Fix 1 (tab preload + IPC bridge) | Foundation task — blocks everything |
| **Phase 0** | Fix 2 (tab ID types in docs) | Update docs before coding |
| **Phase 0** | Fix 4 (sandbox doc alignment) | Update product doc |
| **Phase 0** | Fix 6 (EventManager cleanup) | During EventBus creation |
| **Phase 0** | Fix 8 (PageContext.ts) | During shared utility creation |
| **Phase 0** | Fix 9 (better-sqlite3 build) | During dependency install |
| **Phase 0** | Fix 15 (Shadow DOM decision) | Before injected script work |
| **Phase 0** | Fix 16 (SessionStore → StorageBackend) | Doc update |
| **Phase 1** | Fix 7 (ghost text rendering) | During ghost-text.js |
| **Phase 1** | Fix 11 (tab-switch events) | During AttentionEngine |
| **Phase 2** | Fix 10 (cross-tab extraction) | During TabSynthesizer |
| **Phase 2** | Fix 12 (onboarding state) | During OnboardingFlow |
| **Anytime** | Fix 13, 14 (minor) | During relevant work |

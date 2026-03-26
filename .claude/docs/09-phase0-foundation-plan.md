# Phase 0: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared infrastructure (EventBus, tab preload, rrweb injection, ring buffer, AI event log, storage, model router) that all features depend on.

**Architecture:** Event-driven pipeline. rrweb captures behavioral data in every tab, sends it through a tab preload IPC bridge to the main process EventBus, which distributes to consumer engines. All AI outputs are logged to AIEventLog. Persistence goes through a StorageBackend abstraction (SQLite now, Supabase later).

**Tech Stack:** Electron 37, TypeScript, Vitest, better-sqlite3, rrweb v2, Zustand

**Prerequisite docs:**
- `.claude/docs/02-architecture.md` — data models, IPC channels, design patterns
- `.claude/docs/05-review-fixes.md` — critical fixes to apply first
- `.claude/docs/08-agentic-engineering.md` — testing protocol

---

### Task 0: Fix Existing Bugs (Day 0)

**Files:**
- Modify: `src/main/Tab.ts:92-98`
- Modify: `src/preload/sidebar.d.ts`

- [ ] **Step 1: Fix getTabHtml and getTabText**

```typescript
// src/main/Tab.ts — replace lines 92-98
async getTabHtml(): Promise<string> {
  return await this.runJs("document.documentElement.outerHTML");
}

async getTabText(): Promise<string> {
  return await this.runJs("document.documentElement.innerText");
}
```

The `return` keyword inside `executeJavaScript` is invalid — it evaluates expressions, not function bodies.

- [ ] **Step 2: Verify the app still builds**

Run: `cd "/Users/yongkangzou/Desktop/ai projects/Strawberry/blueberry-browser-20260326" && pnpm build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/Tab.ts
git commit -m "fix: remove invalid return in getTabHtml/getTabText executeJavaScript calls"
```

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd "/Users/yongkangzou/Desktop/ai projects/Strawberry/blueberry-browser-20260326"
pnpm add rrweb rrweb-player zustand
```

- [ ] **Step 2: Install dev/test dependencies**

```bash
pnpm add -D vitest @types/better-sqlite3
```

Note: `better-sqlite3` requires native rebuild for Electron. The existing `postinstall` script runs `electron-builder install-app-deps` which handles this. If it fails, fallback to `sql.js` (WASM, no native build needed).

- [ ] **Step 3: Try installing better-sqlite3**

```bash
pnpm add better-sqlite3
```

If this fails with native build errors, run instead:
```bash
pnpm add sql.js
```
And adapt the StorageBackend implementation accordingly.

- [ ] **Step 4: Add vitest config**

Create `vitest.config.ts` in project root:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'out', 'dist'],
  },
})
```

- [ ] **Step 5: Add test script to package.json**

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify install and build**

```bash
pnpm test 2>&1 || echo "No tests yet — expected"
pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add rrweb, zustand, better-sqlite3, vitest dependencies"
```

---

### Task 2: EventBus

**Files:**
- Create: `src/main/EventBus.ts`
- Create: `src/main/__tests__/EventBus.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/main/__tests__/EventBus.test.ts
import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../EventBus'

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('test:event', handler)
    bus.emit('test:event', { data: 'hello' })
    expect(handler).toHaveBeenCalledWith({ data: 'hello' })
  })

  it('does not deliver events after unsubscribe', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('test:event', handler)
    bus.off('test:event', handler)
    bus.emit('test:event', { data: 'hello' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('delivers to multiple subscribers', () => {
    const bus = new EventBus()
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    bus.on('test:event', handler1)
    bus.on('test:event', handler2)
    bus.emit('test:event', { data: 'hello' })
    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
  })

  it('isolates different event types', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('type-a', handler)
    bus.emit('type-b', { data: 'hello' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not throw when emitting with no subscribers', () => {
    const bus = new EventBus()
    expect(() => bus.emit('no-listeners', {})).not.toThrow()
  })

  it('removes all listeners for a channel', () => {
    const bus = new EventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('ch', h1)
    bus.on('ch', h2)
    bus.removeAll('ch')
    bus.emit('ch', {})
    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })

  it('cleanup removes all listeners on all channels', () => {
    const bus = new EventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('ch-a', h1)
    bus.on('ch-b', h2)
    bus.cleanup()
    bus.emit('ch-a', {})
    bus.emit('ch-b', {})
    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test EventBus`
Expected: FAIL — `Cannot find module '../EventBus'`

- [ ] **Step 3: Implement EventBus**

```typescript
// src/main/EventBus.ts
type EventHandler = (data: any) => void

export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map()

  on(channel: string, handler: EventHandler): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set())
    }
    this.listeners.get(channel)!.add(handler)
  }

  off(channel: string, handler: EventHandler): void {
    this.listeners.get(channel)?.delete(handler)
  }

  emit(channel: string, data: any): void {
    this.listeners.get(channel)?.forEach((handler) => handler(data))
  }

  removeAll(channel: string): void {
    this.listeners.delete(channel)
  }

  cleanup(): void {
    this.listeners.clear()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test EventBus`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/EventBus.ts src/main/__tests__/EventBus.test.ts
git commit -m "feat: add EventBus — pub/sub for rrweb events and engine communication"
```

---

### Task 3: RrwebRingBuffer

**Files:**
- Create: `src/main/RrwebRingBuffer.ts`
- Create: `src/main/__tests__/RrwebRingBuffer.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/main/__tests__/RrwebRingBuffer.test.ts
import { describe, it, expect } from 'vitest'
import { RrwebRingBuffer } from '../RrwebRingBuffer'

const makeEvent = (timestamp: number, size = 100) => ({
  type: 3,
  data: { source: 1, positions: [{ x: 0, y: 0 }] },
  timestamp,
  _estimatedSize: size,
})

describe('RrwebRingBuffer', () => {
  it('stores and retrieves events', () => {
    const buf = new RrwebRingBuffer(1024)
    const ev = makeEvent(1000)
    buf.push(ev)
    expect(buf.getAll()).toHaveLength(1)
    expect(buf.getAll()[0]).toBe(ev)
  })

  it('evicts oldest events when capacity exceeded', () => {
    const buf = new RrwebRingBuffer(250) // fits ~2 events of size 100
    buf.push(makeEvent(1000, 100))
    buf.push(makeEvent(2000, 100))
    buf.push(makeEvent(3000, 100)) // should evict first
    const all = buf.getAll()
    expect(all).toHaveLength(2)
    expect(all[0].timestamp).toBe(2000)
    expect(all[1].timestamp).toBe(3000)
  })

  it('getRange returns events within time window', () => {
    const buf = new RrwebRingBuffer(10000)
    buf.push(makeEvent(1000))
    buf.push(makeEvent(2000))
    buf.push(makeEvent(3000))
    buf.push(makeEvent(4000))
    const range = buf.getRange(2000, 3000)
    expect(range).toHaveLength(2)
    expect(range[0].timestamp).toBe(2000)
    expect(range[1].timestamp).toBe(3000)
  })

  it('getRecent returns events from last N milliseconds', () => {
    const buf = new RrwebRingBuffer(10000)
    const now = Date.now()
    buf.push(makeEvent(now - 5000))
    buf.push(makeEvent(now - 2000))
    buf.push(makeEvent(now - 500))
    const recent = buf.getRecent(3000)
    expect(recent).toHaveLength(2)
  })

  it('handles empty buffer gracefully', () => {
    const buf = new RrwebRingBuffer(1024)
    expect(buf.getAll()).toEqual([])
    expect(buf.getRange(0, 9999)).toEqual([])
    expect(buf.getRecent(1000)).toEqual([])
  })

  it('reports current size', () => {
    const buf = new RrwebRingBuffer(10000)
    expect(buf.size).toBe(0)
    buf.push(makeEvent(1000, 200))
    expect(buf.size).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test RrwebRingBuffer`
Expected: FAIL

- [ ] **Step 3: Implement RrwebRingBuffer**

```typescript
// src/main/RrwebRingBuffer.ts
export interface RrwebEvent {
  type: number
  data: any
  timestamp: number
  [key: string]: any
}

export class RrwebRingBuffer {
  private buffer: RrwebEvent[] = []
  private currentSizeBytes = 0
  private readonly maxSizeBytes: number

  constructor(maxSizeBytes: number = 50 * 1024 * 1024) {
    this.maxSizeBytes = maxSizeBytes
  }

  push(event: RrwebEvent): void {
    const size = this.estimateSize(event)
    while (this.currentSizeBytes + size > this.maxSizeBytes && this.buffer.length > 0) {
      this.evictOldest()
    }
    this.buffer.push(event)
    this.currentSizeBytes += size
  }

  getAll(): RrwebEvent[] {
    return [...this.buffer]
  }

  getRange(startTime: number, endTime: number): RrwebEvent[] {
    return this.buffer.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime)
  }

  getRecent(ms: number): RrwebEvent[] {
    const cutoff = Date.now() - ms
    return this.buffer.filter((e) => e.timestamp >= cutoff)
  }

  get size(): number {
    return this.currentSizeBytes
  }

  get count(): number {
    return this.buffer.length
  }

  private evictOldest(): void {
    const removed = this.buffer.shift()
    if (removed) {
      this.currentSizeBytes -= this.estimateSize(removed)
      if (this.currentSizeBytes < 0) this.currentSizeBytes = 0
    }
  }

  private estimateSize(event: RrwebEvent): number {
    // Use _estimatedSize if provided (for testing), otherwise rough JSON estimate
    if (event._estimatedSize) return event._estimatedSize
    return JSON.stringify(event).length * 2 // UTF-16 approximate
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test RrwebRingBuffer`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/RrwebRingBuffer.ts src/main/__tests__/RrwebRingBuffer.test.ts
git commit -m "feat: add RrwebRingBuffer — capped in-memory event store with time-range queries"
```

---

### Task 4: AIEventLog

**Files:**
- Create: `src/main/AIEventLog.ts`
- Create: `src/main/__tests__/AIEventLog.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/main/__tests__/AIEventLog.test.ts
import { describe, it, expect } from 'vitest'
import { AIEventLog, type AIEvent } from '../AIEventLog'

const makeAIEvent = (overrides: Partial<AIEvent> = {}): AIEvent => ({
  id: `evt-${Math.random()}`,
  timestamp: Date.now(),
  tabId: 'tab-1',
  type: 'annotation',
  trigger: { source: 'attention' },
  output: { model: 'cloud', content: 'test', latencyMs: 100 },
  disposition: 'pending',
  ...overrides,
})

describe('AIEventLog', () => {
  it('logs and retrieves events', () => {
    const log = new AIEventLog()
    const evt = makeAIEvent()
    log.log(evt)
    expect(log.getAll()).toHaveLength(1)
    expect(log.getAll()[0]).toBe(evt)
  })

  it('caps at maxEvents', () => {
    const log = new AIEventLog(3)
    log.log(makeAIEvent({ id: '1' }))
    log.log(makeAIEvent({ id: '2' }))
    log.log(makeAIEvent({ id: '3' }))
    log.log(makeAIEvent({ id: '4' }))
    expect(log.getAll()).toHaveLength(3)
    expect(log.getAll()[0].id).toBe('2') // oldest evicted
  })

  it('filters by tabId', () => {
    const log = new AIEventLog()
    log.log(makeAIEvent({ tabId: 'tab-1' }))
    log.log(makeAIEvent({ tabId: 'tab-2' }))
    log.log(makeAIEvent({ tabId: 'tab-1' }))
    expect(log.getByTab('tab-1')).toHaveLength(2)
    expect(log.getByTab('tab-2')).toHaveLength(1)
  })

  it('filters by type', () => {
    const log = new AIEventLog()
    log.log(makeAIEvent({ type: 'annotation' }))
    log.log(makeAIEvent({ type: 'ghost-text' }))
    log.log(makeAIEvent({ type: 'annotation' }))
    expect(log.getByType('annotation')).toHaveLength(2)
    expect(log.getByType('ghost-text')).toHaveLength(1)
  })

  it('calculates accept rate', () => {
    const log = new AIEventLog()
    log.log(makeAIEvent({ type: 'ghost-text', disposition: 'accepted' }))
    log.log(makeAIEvent({ type: 'ghost-text', disposition: 'accepted' }))
    log.log(makeAIEvent({ type: 'ghost-text', disposition: 'dismissed' }))
    expect(log.getAcceptRate('ghost-text')).toBeCloseTo(0.667, 2)
  })

  it('returns 0 accept rate when no events of type', () => {
    const log = new AIEventLog()
    expect(log.getAcceptRate('ghost-text')).toBe(0)
  })

  it('updates disposition', () => {
    const log = new AIEventLog()
    const evt = makeAIEvent({ id: 'evt-1', disposition: 'pending' })
    log.log(evt)
    log.updateDisposition('evt-1', 'accepted')
    expect(log.getAll()[0].disposition).toBe('accepted')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test AIEventLog`
Expected: FAIL

- [ ] **Step 3: Implement AIEventLog**

```typescript
// src/main/AIEventLog.ts
export type AIEventType =
  | 'annotation'
  | 'ghost-text'
  | 'synthesis'
  | 'sandbox'
  | 'page-rewrite'
  | 'workflow-step'
  | 'selection-explain'

export type AIEventDisposition = 'pending' | 'accepted' | 'dismissed' | 'expired'

export interface AIEvent {
  id: string
  timestamp: number
  tabId: string
  type: AIEventType
  trigger: {
    source: 'attention' | 'selection' | 'typing' | 'tab-switch' | 'user-chat' | 'manual'
    signal?: any
    userInput?: string
  }
  output: {
    model: 'local' | 'cloud'
    content: any
    latencyMs: number
  }
  disposition: AIEventDisposition
}

export class AIEventLog {
  private events: AIEvent[] = []
  private readonly maxEvents: number

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents
  }

  log(event: AIEvent): void {
    this.events.push(event)
    while (this.events.length > this.maxEvents) {
      this.events.shift()
    }
  }

  getAll(): AIEvent[] {
    return [...this.events]
  }

  getByTab(tabId: string): AIEvent[] {
    return this.events.filter((e) => e.tabId === tabId)
  }

  getByType(type: AIEventType): AIEvent[] {
    return this.events.filter((e) => e.type === type)
  }

  getAcceptRate(type: AIEventType): number {
    const ofType = this.getByType(type)
    if (ofType.length === 0) return 0
    const accepted = ofType.filter((e) => e.disposition === 'accepted').length
    return accepted / ofType.length
  }

  updateDisposition(eventId: string, disposition: AIEventDisposition): void {
    const event = this.events.find((e) => e.id === eventId)
    if (event) {
      event.disposition = disposition
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test AIEventLog`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/AIEventLog.ts src/main/__tests__/AIEventLog.test.ts
git commit -m "feat: add AIEventLog — append-only log for all AI actions with accept rate tracking"
```

---

### Task 5: Tab Preload IPC Bridge

**Files:**
- Create: `src/preload/tab.ts`
- Create: `src/preload/tab.d.ts`
- Modify: `src/main/Tab.ts:16-23`
- Modify: `electron.vite.config.ts:13-16`

- [ ] **Step 1: Create tab preload script**

```typescript
// src/preload/tab.ts
import { contextBridge, ipcRenderer } from 'electron'

const SEND_CHANNELS = [
  'rrweb:event',
  'attention:signal',
  'completion:request',
  'selection:action',
] as const

const RECEIVE_CHANNELS = [
  'completion:response',
  'attention:command',
  'page:rewrite',
  'page:restore',
] as const

type SendChannel = (typeof SEND_CHANNELS)[number]
type ReceiveChannel = (typeof RECEIVE_CHANNELS)[number]

contextBridge.exposeInMainWorld('blueberry', {
  send(channel: SendChannel, data: unknown): void {
    if ((SEND_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },

  on(channel: ReceiveChannel, callback: (...args: unknown[]) => void): void {
    if ((RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },

  removeListener(channel: ReceiveChannel, callback: (...args: unknown[]) => void): void {
    if ((RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.removeListener(channel, callback)
    }
  },
})
```

- [ ] **Step 2: Create type declaration**

```typescript
// src/preload/tab.d.ts
export interface BlueberryBridge {
  send(channel: string, data: unknown): void
  on(channel: string, callback: (...args: unknown[]) => void): void
  removeListener(channel: string, callback: (...args: unknown[]) => void): void
}

declare global {
  interface Window {
    blueberry: BlueberryBridge
  }
}
```

- [ ] **Step 3: Add tab preload to electron-vite config**

```typescript
// electron.vite.config.ts — update the preload.build.rollupOptions.input
input: {
  topbar: resolve(__dirname, "src/preload/topbar.ts"),
  sidebar: resolve(__dirname, "src/preload/sidebar.ts"),
  tab: resolve(__dirname, "src/preload/tab.ts"),
},
```

- [ ] **Step 4: Add preload to Tab.ts WebContentsView**

```typescript
// src/main/Tab.ts — update the constructor's webPreferences
// Add import at top:
import { join } from 'path'

// Update WebContentsView creation (lines 16-23):
this.webContentsView = new WebContentsView({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    preload: join(__dirname, '../preload/tab.js'),
  },
});
```

- [ ] **Step 5: Build and verify**

Run: `pnpm build`
Expected: Build succeeds. `out/preload/tab.js` exists.

- [ ] **Step 6: Commit**

```bash
git add src/preload/tab.ts src/preload/tab.d.ts electron.vite.config.ts src/main/Tab.ts
git commit -m "feat: add tab preload IPC bridge — enables injected scripts to communicate with main process"
```

---

### Task 6: InjectionRegistry

**Files:**
- Create: `src/main/InjectionRegistry.ts`
- Create: `src/main/__tests__/InjectionRegistry.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/main/__tests__/InjectionRegistry.test.ts
import { describe, it, expect, vi } from 'vitest'
import { InjectionRegistry } from '../InjectionRegistry'

// Mock Tab with a minimal interface
const createMockTab = () => ({
  id: 'tab-1',
  runJs: vi.fn().mockResolvedValue(undefined),
  webContents: {
    on: vi.fn(),
    removeListener: vi.fn(),
  },
})

describe('InjectionRegistry', () => {
  it('registers and injects scripts into a tab', async () => {
    const registry = new InjectionRegistry()
    const tab = createMockTab()
    registry.register('test-script', 'console.log("hello")')
    await registry.injectAll(tab as any)
    expect(tab.runJs).toHaveBeenCalledWith('console.log("hello")')
  })

  it('injects scripts in dependency order', async () => {
    const registry = new InjectionRegistry()
    const tab = createMockTab()
    const callOrder: string[] = []
    tab.runJs.mockImplementation((code: string) => {
      callOrder.push(code)
      return Promise.resolve()
    })

    registry.register('script-b', 'B', { dependencies: ['script-a'] })
    registry.register('script-a', 'A')

    await registry.injectAll(tab as any)
    expect(callOrder).toEqual(['A', 'B'])
  })

  it('does not inject the same script twice', async () => {
    const registry = new InjectionRegistry()
    const tab = createMockTab()
    registry.register('once', 'console.log("once")')
    await registry.injectAll(tab as any)
    await registry.injectAll(tab as any)
    // Second call should still inject (for re-injection on navigation)
    expect(tab.runJs).toHaveBeenCalledTimes(2)
  })

  it('removes a registered script', () => {
    const registry = new InjectionRegistry()
    registry.register('removable', 'code')
    registry.unregister('removable')
    const tab = createMockTab()
    registry.injectAll(tab as any)
    expect(tab.runJs).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test InjectionRegistry`
Expected: FAIL

- [ ] **Step 3: Implement InjectionRegistry**

```typescript
// src/main/InjectionRegistry.ts
import type { Tab } from './Tab'

interface RegisteredScript {
  name: string
  code: string
  dependencies: string[]
}

export class InjectionRegistry {
  private scripts: Map<string, RegisteredScript> = new Map()

  register(name: string, code: string, options: { dependencies?: string[] } = {}): void {
    this.scripts.set(name, {
      name,
      code,
      dependencies: options.dependencies ?? [],
    })
  }

  unregister(name: string): void {
    this.scripts.delete(name)
  }

  async injectAll(tab: Tab): Promise<void> {
    const sorted = this.topologicalSort()
    for (const script of sorted) {
      try {
        await tab.runJs(script.code)
      } catch (err) {
        console.error(`Failed to inject ${script.name} into ${tab.id}:`, err)
      }
    }
  }

  private topologicalSort(): RegisteredScript[] {
    const visited = new Set<string>()
    const result: RegisteredScript[] = []

    const visit = (name: string) => {
      if (visited.has(name)) return
      visited.add(name)
      const script = this.scripts.get(name)
      if (!script) return
      for (const dep of script.dependencies) {
        visit(dep)
      }
      result.push(script)
    }

    for (const name of this.scripts.keys()) {
      visit(name)
    }
    return result
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test InjectionRegistry`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/InjectionRegistry.ts src/main/__tests__/InjectionRegistry.test.ts
git commit -m "feat: add InjectionRegistry — manages script injection with dependency ordering"
```

---

### Task 7: PageContext Shared Utilities

**Files:**
- Create: `src/main/PageContext.ts`
- Create: `src/main/__tests__/PageContext.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/main/__tests__/PageContext.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildPageContext, type PageContext } from '../PageContext'

const createMockTab = (overrides = {}) => ({
  id: 'tab-1',
  url: 'https://example.com',
  title: 'Example Page',
  getTabText: vi.fn().mockResolvedValue('Hello world content'),
  screenshot: vi.fn().mockResolvedValue({ toDataURL: () => 'data:image/png;base64,abc' }),
  ...overrides,
})

describe('buildPageContext', () => {
  it('returns correct page context', async () => {
    const tab = createMockTab()
    const ctx = await buildPageContext(tab as any)
    expect(ctx.tabId).toBe('tab-1')
    expect(ctx.url).toBe('https://example.com')
    expect(ctx.title).toBe('Example Page')
    expect(ctx.content).toBe('Hello world content')
  })

  it('truncates content to maxLength', async () => {
    const longText = 'a'.repeat(5000)
    const tab = createMockTab({ getTabText: vi.fn().mockResolvedValue(longText) })
    const ctx = await buildPageContext(tab as any, { maxContentLength: 100 })
    expect(ctx.content!.length).toBeLessThanOrEqual(103) // 100 + '...'
  })

  it('handles getTabText failure gracefully', async () => {
    const tab = createMockTab({ getTabText: vi.fn().mockRejectedValue(new Error('fail')) })
    const ctx = await buildPageContext(tab as any)
    expect(ctx.content).toBeUndefined()
  })

  it('optionally includes screenshot', async () => {
    const tab = createMockTab()
    const ctx = await buildPageContext(tab as any, { includeScreenshot: true })
    expect(ctx.screenshot).toBe('data:image/png;base64,abc')
  })

  it('excludes screenshot by default', async () => {
    const tab = createMockTab()
    const ctx = await buildPageContext(tab as any)
    expect(ctx.screenshot).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test PageContext`
Expected: FAIL

- [ ] **Step 3: Implement PageContext**

```typescript
// src/main/PageContext.ts
import type { Tab } from './Tab'

export interface PageContext {
  tabId: string
  url: string
  title: string
  content?: string
  screenshot?: string
}

export interface PageContextOptions {
  maxContentLength?: number
  includeScreenshot?: boolean
}

const DEFAULT_MAX_CONTENT = 4000

export async function buildPageContext(
  tab: Tab,
  options: PageContextOptions = {}
): Promise<PageContext> {
  const { maxContentLength = DEFAULT_MAX_CONTENT, includeScreenshot = false } = options

  const ctx: PageContext = {
    tabId: tab.id,
    url: tab.url,
    title: tab.title,
  }

  // Extract text content
  try {
    const text = await tab.getTabText()
    ctx.content =
      text.length > maxContentLength ? text.substring(0, maxContentLength) + '...' : text
  } catch {
    // Page may not be ready or may block script execution
  }

  // Capture screenshot if requested
  if (includeScreenshot) {
    try {
      const image = await tab.screenshot()
      ctx.screenshot = image.toDataURL()
    } catch {
      // Screenshot may fail on some pages
    }
  }

  return ctx
}

export async function getAllTabContexts(
  tabs: Tab[],
  options: PageContextOptions = {}
): Promise<PageContext[]> {
  return Promise.all(tabs.map((tab) => buildPageContext(tab, options)))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test PageContext`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/PageContext.ts src/main/__tests__/PageContext.test.ts
git commit -m "feat: add PageContext — shared utility for extracting tab context across all engines"
```

---

### Task 8: ModelRouter

**Files:**
- Create: `src/main/ModelRouter.ts`
- Create: `src/main/__tests__/ModelRouter.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/main/__tests__/ModelRouter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ModelRouter } from '../ModelRouter'

describe('ModelRouter', () => {
  it('routes fast tasks to local model when available', async () => {
    const localInfer = vi.fn().mockResolvedValue({ result: 'local-result', confidence: 0.9 })
    const cloudInfer = vi.fn()
    const router = new ModelRouter({ localInfer, cloudInfer })

    const result = await router.infer({
      task: 'completion',
      input: { text: 'hello' },
      latencyBudget: 'fast',
    })
    expect(result.model).toBe('local')
    expect(localInfer).toHaveBeenCalled()
    expect(cloudInfer).not.toHaveBeenCalled()
  })

  it('routes normal tasks to cloud model', async () => {
    const localInfer = vi.fn()
    const cloudInfer = vi.fn().mockResolvedValue({ result: 'cloud-result', confidence: 0.95 })
    const router = new ModelRouter({ localInfer, cloudInfer })

    const result = await router.infer({
      task: 'synthesize',
      input: { text: 'compare these' },
      latencyBudget: 'normal',
    })
    expect(result.model).toBe('cloud')
    expect(cloudInfer).toHaveBeenCalled()
  })

  it('falls back to cloud when local is unavailable', async () => {
    const cloudInfer = vi.fn().mockResolvedValue({ result: 'fallback', confidence: 0.9 })
    const router = new ModelRouter({ localInfer: null, cloudInfer })

    const result = await router.infer({
      task: 'completion',
      input: { text: 'hello' },
      latencyBudget: 'fast',
    })
    expect(result.model).toBe('cloud')
  })

  it('falls back to cloud when local confidence is below threshold', async () => {
    const localInfer = vi.fn().mockResolvedValue({ result: 'unsure', confidence: 0.3 })
    const cloudInfer = vi.fn().mockResolvedValue({ result: 'sure', confidence: 0.9 })
    const router = new ModelRouter({ localInfer, cloudInfer })

    const result = await router.infer({
      task: 'completion',
      input: { text: 'hello' },
      latencyBudget: 'fast',
      confidenceThreshold: 0.5,
    })
    expect(result.model).toBe('cloud')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test ModelRouter`
Expected: FAIL

- [ ] **Step 3: Implement ModelRouter**

```typescript
// src/main/ModelRouter.ts
export type InferenceTask = 'completion' | 'explain' | 'synthesize' | 'rewrite' | 'classify'

export interface InferenceRequest {
  task: InferenceTask
  input: { text?: string; image?: string; context?: any }
  latencyBudget: 'fast' | 'normal'
  confidenceThreshold?: number
}

export interface InferenceResponse {
  result: any
  model: 'local' | 'cloud'
  confidence: number
  latencyMs?: number
}

type InferFn = (request: InferenceRequest) => Promise<{ result: any; confidence: number }>

interface ModelRouterOptions {
  localInfer: InferFn | null
  cloudInfer: InferFn
}

export class ModelRouter {
  private localInfer: InferFn | null
  private cloudInfer: InferFn

  constructor(options: ModelRouterOptions) {
    this.localInfer = options.localInfer
    this.cloudInfer = options.cloudInfer
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const start = Date.now()
    const threshold = request.confidenceThreshold ?? 0.5

    // Try local first for fast tasks
    if (request.latencyBudget === 'fast' && this.localInfer) {
      try {
        const local = await this.localInfer(request)
        if (local.confidence >= threshold) {
          return {
            result: local.result,
            model: 'local',
            confidence: local.confidence,
            latencyMs: Date.now() - start,
          }
        }
      } catch {
        // Fall through to cloud
      }
    }

    // Cloud path
    const cloud = await this.cloudInfer(request)
    return {
      result: cloud.result,
      model: 'cloud',
      confidence: cloud.confidence,
      latencyMs: Date.now() - start,
    }
  }

  setLocalInfer(fn: InferFn | null): void {
    this.localInfer = fn
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test ModelRouter`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ModelRouter.ts src/main/__tests__/ModelRouter.test.ts
git commit -m "feat: add ModelRouter — routes inference between local VLM and cloud LLM with fallback"
```

---

### Task 9: StorageBackend + SQLite

**Files:**
- Create: `src/main/StorageBackend.ts`
- Create: `src/main/SqliteBackend.ts`
- Create: `src/main/__tests__/SqliteBackend.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/main/__tests__/SqliteBackend.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SqliteBackend } from '../SqliteBackend'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'

const TEST_DB = join(__dirname, 'test-blueberry.db')

describe('SqliteBackend', () => {
  let backend: SqliteBackend

  beforeEach(() => {
    backend = new SqliteBackend(TEST_DB)
  })

  afterEach(() => {
    backend.close()
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  })

  it('saves and retrieves a workflow', async () => {
    const workflow = {
      id: 'wf-1',
      name: 'Test Workflow',
      createdAt: Date.now(),
      durationMs: 5000,
      actionsJson: JSON.stringify([{ step: 1, action: 'navigate' }]),
      summary: 'A test workflow',
    }
    await backend.saveWorkflow(workflow)
    const workflows = await backend.getWorkflows()
    expect(workflows).toHaveLength(1)
    expect(workflows[0].id).toBe('wf-1')
    expect(workflows[0].name).toBe('Test Workflow')
  })

  it('deletes a workflow', async () => {
    await backend.saveWorkflow({ id: 'wf-del', name: 'Delete Me', createdAt: Date.now(), durationMs: 0, actionsJson: '[]' })
    await backend.deleteWorkflow('wf-del')
    expect(await backend.getWorkflows()).toHaveLength(0)
  })

  it('saves and searches URLs', async () => {
    await backend.saveUrls([
      { url: 'https://github.com/test', title: 'GitHub', visitCount: 5, lastVisited: Date.now(), domain: 'github.com' },
      { url: 'https://google.com', title: 'Google', visitCount: 10, lastVisited: Date.now(), domain: 'google.com' },
    ])
    const results = await backend.searchUrls('git')
    expect(results).toHaveLength(1)
    expect(results[0].domain).toBe('github.com')
  })

  it('saves and retrieves user profile', async () => {
    await backend.saveProfile({ key: 'interests', value: ['AI', 'web'] })
    const profile = await backend.getProfile('interests')
    expect(profile).toEqual({ key: 'interests', value: ['AI', 'web'] })
  })

  it('returns null for missing profile key', async () => {
    const profile = await backend.getProfile('nonexistent')
    expect(profile).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test SqliteBackend`
Expected: FAIL

- [ ] **Step 3: Implement StorageBackend interface**

```typescript
// src/main/StorageBackend.ts
export interface WorkflowRecord {
  id: string
  name?: string
  createdAt: number
  durationMs: number
  actionsJson: string
  rrwebEventsBlob?: Buffer
  summary?: string
  tags?: string
}

export interface UrlCompletion {
  url: string
  title?: string
  visitCount: number
  lastVisited: number
  domain: string
  topicCluster?: string
}

export interface ProfileEntry {
  key: string
  value: any
}

export interface SavedScript {
  id: string
  name: string
  prompt: string
  script: string
  sourceUrlPattern?: string
  createdAt: number
  lastUsedAt?: number
  useCount: number
}

export interface StorageBackend {
  saveWorkflow(workflow: WorkflowRecord): Promise<void>
  getWorkflows(): Promise<WorkflowRecord[]>
  deleteWorkflow(id: string): Promise<void>

  saveScript(script: SavedScript): Promise<void>
  getScriptsForUrl(url: string): Promise<SavedScript[]>
  deleteScript(id: string): Promise<void>

  saveProfile(entry: ProfileEntry): Promise<void>
  getProfile(key: string): Promise<ProfileEntry | null>

  saveUrls(entries: UrlCompletion[]): Promise<void>
  searchUrls(prefix: string, limit?: number): Promise<UrlCompletion[]>

  close(): void
}
```

- [ ] **Step 4: Implement SqliteBackend**

```typescript
// src/main/SqliteBackend.ts
import Database from 'better-sqlite3'
import type { StorageBackend, WorkflowRecord, UrlCompletion, ProfileEntry, SavedScript } from './StorageBackend'

export class SqliteBackend implements StorageBackend {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.createTables()
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        actions_json TEXT NOT NULL,
        rrweb_events_blob BLOB,
        summary TEXT,
        tags TEXT,
        synced_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS url_completions (
        url TEXT PRIMARY KEY,
        title TEXT,
        visit_count INTEGER DEFAULT 1,
        last_visited INTEGER,
        domain TEXT,
        topic_cluster TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_url_domain ON url_completions(domain);
      CREATE INDEX IF NOT EXISTS idx_url_last_visited ON url_completions(last_visited DESC);

      CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value_json TEXT,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS saved_scripts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        script TEXT NOT NULL,
        source_url_pattern TEXT,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER,
        use_count INTEGER DEFAULT 0,
        synced_at INTEGER
      );
    `)
  }

  async saveWorkflow(wf: WorkflowRecord): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO workflows (id, name, created_at, duration_ms, actions_json, rrweb_events_blob, summary, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(wf.id, wf.name ?? null, wf.createdAt, wf.durationMs, wf.actionsJson, wf.rrwebEventsBlob ?? null, wf.summary ?? null, wf.tags ?? null)
  }

  async getWorkflows(): Promise<WorkflowRecord[]> {
    return this.db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all() as WorkflowRecord[]
  }

  async deleteWorkflow(id: string): Promise<void> {
    this.db.prepare('DELETE FROM workflows WHERE id = ?').run(id)
  }

  async saveScript(s: SavedScript): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO saved_scripts (id, name, prompt, script, source_url_pattern, created_at, last_used_at, use_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s.id, s.name, s.prompt, s.script, s.sourceUrlPattern ?? null, s.createdAt, s.lastUsedAt ?? null, s.useCount)
  }

  async getScriptsForUrl(url: string): Promise<SavedScript[]> {
    return this.db.prepare(
      'SELECT * FROM saved_scripts WHERE source_url_pattern IS NULL OR ? LIKE source_url_pattern ORDER BY use_count DESC'
    ).all(url) as SavedScript[]
  }

  async deleteScript(id: string): Promise<void> {
    this.db.prepare('DELETE FROM saved_scripts WHERE id = ?').run(id)
  }

  async saveProfile(entry: ProfileEntry): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO user_profile (key, value_json, updated_at)
      VALUES (?, ?, ?)
    `).run(entry.key, JSON.stringify(entry.value), Date.now())
  }

  async getProfile(key: string): Promise<ProfileEntry | null> {
    const row = this.db.prepare('SELECT * FROM user_profile WHERE key = ?').get(key) as any
    if (!row) return null
    return { key: row.key, value: JSON.parse(row.value_json) }
  }

  async saveUrls(entries: UrlCompletion[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO url_completions (url, title, visit_count, last_visited, domain, topic_cluster)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const tx = this.db.transaction((entries: UrlCompletion[]) => {
      for (const e of entries) {
        insert.run(e.url, e.title ?? null, e.visitCount, e.lastVisited, e.domain, e.topicCluster ?? null)
      }
    })
    tx(entries)
  }

  async searchUrls(prefix: string, limit = 10): Promise<UrlCompletion[]> {
    return this.db.prepare(
      'SELECT * FROM url_completions WHERE url LIKE ? OR title LIKE ? ORDER BY visit_count DESC LIMIT ?'
    ).all(`%${prefix}%`, `%${prefix}%`, limit) as UrlCompletion[]
  }

  close(): void {
    this.db.close()
  }
}
```

- [ ] **Step 4b: Run tests to verify they pass**

Run: `pnpm test SqliteBackend`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/StorageBackend.ts src/main/SqliteBackend.ts src/main/__tests__/SqliteBackend.test.ts
git commit -m "feat: add StorageBackend interface + SqliteBackend — local-first persistence with future Supabase swap"
```

---

### Task 10: Wire Foundation into App

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/Window.ts`
- Modify: `src/main/Tab.ts` (add rrweb injection hook)

- [ ] **Step 1: Create app-level initialization in index.ts**

Add EventBus, AIEventLog, InjectionRegistry, and StorageBackend to the app lifecycle:

```typescript
// src/main/index.ts — add imports
import { EventBus } from './EventBus'
import { RrwebRingBuffer } from './RrwebRingBuffer'
import { AIEventLog } from './AIEventLog'
import { InjectionRegistry } from './InjectionRegistry'
import { ModelRouter } from './ModelRouter'

// Add after existing let declarations:
let eventBus: EventBus | null = null
let ringBuffer: RrwebRingBuffer | null = null
let aiEventLog: AIEventLog | null = null
let injectionRegistry: InjectionRegistry | null = null
let modelRouter: ModelRouter | null = null

// Update createWindow:
const createWindow = (): Window => {
  eventBus = new EventBus()
  ringBuffer = new RrwebRingBuffer()
  aiEventLog = new AIEventLog()
  injectionRegistry = new InjectionRegistry()
  modelRouter = new ModelRouter({
    localInfer: null, // Phase 7: LFM2-VL will be wired here
    cloudInfer: async (req) => ({ result: '', confidence: 0.9 }), // Phase 1: CompletionEngine will replace this
  })

  const window = new Window({ eventBus, ringBuffer, aiEventLog, injectionRegistry })
  menu = new AppMenu(window)
  eventManager = new EventManager(window)
  return window
}
```

- [ ] **Step 2: Update Window constructor to accept foundation services**

```typescript
// src/main/Window.ts — update constructor signature
import { EventBus } from './EventBus'
import { RrwebRingBuffer } from './RrwebRingBuffer'
import { AIEventLog } from './AIEventLog'
import { InjectionRegistry } from './InjectionRegistry'

interface WindowServices {
  eventBus: EventBus
  ringBuffer: RrwebRingBuffer
  aiEventLog: AIEventLog
  injectionRegistry: InjectionRegistry
}

export class Window {
  // Add as class fields:
  readonly eventBus: EventBus
  readonly ringBuffer: RrwebRingBuffer
  readonly aiEventLog: AIEventLog
  readonly injectionRegistry: InjectionRegistry

  constructor(services: WindowServices) {
    this.eventBus = services.eventBus
    this.ringBuffer = services.ringBuffer
    this.aiEventLog = services.aiEventLog
    this.injectionRegistry = services.injectionRegistry
    // ... rest of existing constructor
  }
}
```

- [ ] **Step 3: Add rrweb IPC listener to wire events into EventBus**

In `EventManager.ts` or in `Window.ts` setup, add:

```typescript
// Listen for rrweb events from tabs and route to EventBus
import { ipcMain } from 'electron'

ipcMain.on('rrweb:event', (_event, data) => {
  this.eventBus.emit('rrweb:event', data)
  this.ringBuffer.push(data)
})
```

- [ ] **Step 4: Build and verify**

Run: `pnpm build`
Expected: Build succeeds. App launches. No console errors on startup.

- [ ] **Step 5: Run all tests**

Run: `pnpm test`
Expected: All tests pass (EventBus, RrwebRingBuffer, AIEventLog, InjectionRegistry, PageContext, ModelRouter, SqliteBackend).

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts src/main/Window.ts src/main/EventManager.ts
git commit -m "feat: wire foundation services into app lifecycle — EventBus, RingBuffer, AIEventLog, InjectionRegistry"
```

---

### Task 11: Phase 0 Pattern Review

Follow the protocol from `08-agentic-engineering.md` Section 3:

- [ ] **Step 1: Check shared patterns**

Verify:
- All engines will use `PageContext.buildPageContext()` (not inline extraction)
- All IPC goes through EventBus (not direct `ipcMain.on` scattered across files)
- Tab IDs are consistently `string` everywhere

- [ ] **Step 2: Check interface consistency**

Verify:
- `RrwebEvent` type is defined in RrwebRingBuffer.ts and used by EventBus consumers
- `AIEvent` type is defined in AIEventLog.ts
- `InferenceRequest/Response` types in ModelRouter.ts
- `PageContext` type in PageContext.ts
- `StorageBackend` interface in StorageBackend.ts

- [ ] **Step 3: Verify test coverage**

Run: `pnpm test`
Expected: 34+ tests pass across 7 test files.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 0 foundation complete — all infrastructure tested and wired"
```

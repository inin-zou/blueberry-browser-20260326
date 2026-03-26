// src/main/AttentionEngine.ts
import { EventBus } from './EventBus'

export type AttentionIntent = 'confused' | 'comparing' | 'interested' | 'searching' | 'deciding' | 'unknown'

export interface AttentionSignal {
  id: string
  tabId: string
  timestamp: number
  type: 'dwell' | 'scroll_slow' | 'scroll_back' | 'click_hesitation' | 'tab_switch' | 'selection'
  data: {
    position?: { x: number; y: number }
    selector?: string
    durationMs?: number
    scrollVelocity?: number
    direction?: 'up' | 'down'
    fromTabId?: string
    toTabId?: string
    switchCount?: number
    selectedText?: string
    surroundingContext?: string
  }
  intentGuess: AttentionIntent
}

// Thresholds (conservative — avoid annoying users)
const DWELL_THRESHOLD_MS = 3000        // 3 seconds of no mouse movement
const SLOW_SCROLL_THRESHOLD = 50       // pixels per second
const SCROLL_BACK_WINDOW_MS = 5000     // detect scroll-back within 5 seconds
const TAB_SWITCH_WINDOW_MS = 60000     // 60 seconds window for tab switch detection
const TAB_SWITCH_COUNT_THRESHOLD = 3   // 3+ switches = comparing
const THROTTLE_MS = 2000               // minimum time between signals of same type

export class AttentionEngine {
  private eventBus: EventBus
  private lastMousePosition: { x: number; y: number; timestamp: number } | null = null
  private dwellTimer: ReturnType<typeof setTimeout> | null = null
  private currentTabId: string | null = null
  private tabSwitchLog: { tabId: string; timestamp: number }[] = []
  private scrollHistory: { y: number; timestamp: number }[] = []
  private lastSignalTime: Map<string, number> = new Map()
  private running = false

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.eventBus.on('rrweb:event', this.handleRrwebEvent)
    this.eventBus.on('tab:switched', this.handleTabSwitch)
  }

  stop(): void {
    this.running = false
    this.eventBus.off('rrweb:event', this.handleRrwebEvent)
    this.eventBus.off('tab:switched', this.handleTabSwitch)
    if (this.dwellTimer) clearTimeout(this.dwellTimer)
  }

  // Arrow functions to preserve `this` context
  private handleRrwebEvent = (event: any): void => {
    if (!event || !event.type) return

    // rrweb event types: 3 = IncrementalSnapshot
    // Source: 1 = MouseMove, 3 = Scroll, 2 = MouseInteraction
    if (event.type === 3 && event.data) {
      switch (event.data.source) {
        case 1: // MouseMove
          this.handleMouseMove(event)
          break
        case 3: // Scroll
          this.handleScroll(event)
          break
        case 2: // MouseInteraction (clicks)
          this.handleMouseInteraction(event)
          break
      }
    }
  }

  private handleTabSwitch = (data: { tabId: string; timestamp: number }): void => {
    const now = data.timestamp || Date.now()
    this.currentTabId = data.tabId

    this.tabSwitchLog.push({ tabId: data.tabId, timestamp: now })

    // Clean old entries
    this.tabSwitchLog = this.tabSwitchLog.filter(
      (entry) => now - entry.timestamp < TAB_SWITCH_WINDOW_MS
    )

    console.log(`[Attention] Tab switch to ${data.tabId}, ${this.tabSwitchLog.length} switches in window (need ${TAB_SWITCH_COUNT_THRESHOLD})`)

    // Count tab switches in window
    if (this.tabSwitchLog.length >= TAB_SWITCH_COUNT_THRESHOLD) {
      console.log(`[Attention] Comparing intent detected! ${this.tabSwitchLog.length} switches`)
      this.emitSignal({
        type: 'tab_switch',
        data: {
          toTabId: data.tabId,
          switchCount: this.tabSwitchLog.length,
        },
        intentGuess: 'comparing',
      })
    }
  }

  private handleMouseMove(event: any): void {
    const positions = event.data?.positions
    if (!positions || positions.length === 0) return
    const pos = positions[positions.length - 1]

    // Clear existing dwell timer
    if (this.dwellTimer) clearTimeout(this.dwellTimer)

    this.lastMousePosition = { x: pos.x, y: pos.y, timestamp: event.timestamp }

    // Start dwell timer
    this.dwellTimer = setTimeout(() => {
      if (this.lastMousePosition) {
        this.emitSignal({
          type: 'dwell',
          data: {
            position: { x: this.lastMousePosition.x, y: this.lastMousePosition.y },
            durationMs: DWELL_THRESHOLD_MS,
          },
          intentGuess: 'confused',
        })
      }
    }, DWELL_THRESHOLD_MS)
  }

  private handleScroll(event: any): void {
    const y = event.data?.y ?? 0
    const now = event.timestamp || Date.now()

    this.scrollHistory.push({ y, timestamp: now })

    // Keep only recent history
    this.scrollHistory = this.scrollHistory.filter(
      (entry) => now - entry.timestamp < SCROLL_BACK_WINDOW_MS
    )

    if (this.scrollHistory.length >= 2) {
      const prev = this.scrollHistory[this.scrollHistory.length - 2]
      const curr = this.scrollHistory[this.scrollHistory.length - 1]
      const dt = curr.timestamp - prev.timestamp
      if (dt <= 0) return

      const velocity = Math.abs(curr.y - prev.y) / (dt / 1000) // px/sec
      const direction = curr.y > prev.y ? 'down' : 'up'

      // Detect slow scroll (reading carefully)
      if (velocity < SLOW_SCROLL_THRESHOLD && velocity > 0) {
        this.emitSignal({
          type: 'scroll_slow',
          data: { scrollVelocity: velocity, direction },
          intentGuess: 'interested',
        })
      }

      // Detect scroll-back (re-reading)
      if (direction === 'up' && this.scrollHistory.length >= 3) {
        const older = this.scrollHistory[this.scrollHistory.length - 3]
        if (older.y < prev.y && curr.y < prev.y) {
          // Was scrolling down, now scrolling up = scroll-back
          this.emitSignal({
            type: 'scroll_back',
            data: { scrollVelocity: velocity, direction: 'up' },
            intentGuess: 'confused',
          })
        }
      }
    }
  }

  private handleMouseInteraction(_event: any): void {
    // MouseInteraction type 2 = Click
    // Could detect click hesitation here by comparing with last mouse move timestamp
    // For Phase 2a, we skip this — will add in Phase 2b
  }

  private emitSignal(partial: { type: AttentionSignal['type']; data: AttentionSignal['data']; intentGuess: AttentionIntent }): void {
    // Throttle: don't emit same type too frequently
    const now = Date.now()
    const lastTime = this.lastSignalTime.get(partial.type) || 0
    if (now - lastTime < THROTTLE_MS) return
    this.lastSignalTime.set(partial.type, now)

    const signal: AttentionSignal = {
      id: `attn-${now}-${Math.random().toString(36).slice(2, 6)}`,
      tabId: this.currentTabId || 'unknown',
      timestamp: now,
      ...partial,
    }

    this.eventBus.emit('attention:detected', signal)
  }

  // For testing — expose thresholds
  static readonly DWELL_THRESHOLD_MS = DWELL_THRESHOLD_MS
  static readonly TAB_SWITCH_COUNT_THRESHOLD = TAB_SWITCH_COUNT_THRESHOLD
  static readonly THROTTLE_MS = THROTTLE_MS
}

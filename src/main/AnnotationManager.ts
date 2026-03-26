// src/main/AnnotationManager.ts
import { EventBus } from './EventBus'
import { AIEventLog } from './AIEventLog'
import type { AttentionSignal } from './AttentionEngine'
import type { Tab } from './Tab'

export interface AnnotationCommand {
  id: string
  type: 'highlight' | 'margin-note' | 'simplification'
  selector?: string           // CSS selector of target element
  position?: { x: number; y: number }
  content?: string            // text content for notes/simplifications
}

export class AnnotationManager {
  private eventBus: EventBus
  private aiEventLog: AIEventLog
  private getActiveTab: () => Tab | null
  private dismissCount = 0
  private isThrottled = false
  private throttleTimer: ReturnType<typeof setTimeout> | null = null
  private _enabled = true

  // Progressive disclosure thresholds
  static readonly DISMISS_THROTTLE_COUNT = 3     // after 3 dismissed, throttle
  static readonly THROTTLE_DURATION_MS = 600000  // throttle for 10 minutes
  static readonly MIN_INTERVAL_MS = 5000         // minimum 5s between annotations

  private lastAnnotationTime = 0

  constructor(eventBus: EventBus, aiEventLog: AIEventLog, getActiveTab: () => Tab | null) {
    this.eventBus = eventBus
    this.aiEventLog = aiEventLog
    this.getActiveTab = getActiveTab
  }

  start(): void {
    this.eventBus.on('attention:detected', this.handleAttentionSignal)
    this.eventBus.on('annotation:dismissed', this.handleDismiss)
  }

  stop(): void {
    this.eventBus.off('attention:detected', this.handleAttentionSignal)
    this.eventBus.off('annotation:dismissed', this.handleDismiss)
    if (this.throttleTimer) clearTimeout(this.throttleTimer)
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled
  }

  get enabled(): boolean {
    return this._enabled
  }

  private handleAttentionSignal = (signal: AttentionSignal): void => {
    // Don't annotate if disabled or throttled
    if (!this._enabled) return
    if (this.isThrottled) return

    // Minimum interval between annotations
    const now = Date.now()
    if (now - this.lastAnnotationTime < AnnotationManager.MIN_INTERVAL_MS) return

    // Only react to certain intents
    if (signal.intentGuess === 'confused' && signal.type === 'dwell') {
      this.sendAnnotation({
        id: `ann-${now}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'highlight',
        position: signal.data.position,
        selector: signal.data.selector,
      }, signal)
    }
    // Could add more: interested → margin-note, etc.
    // For Phase 2b, just highlight on dwell is sufficient
  }

  private handleDismiss = (data: { annotationId: string }): void => {
    this.dismissCount++

    // Log dismiss in AIEventLog
    this.aiEventLog.updateDisposition(data.annotationId, 'dismissed')

    // Progressive disclosure: throttle after N dismissals
    if (this.dismissCount >= AnnotationManager.DISMISS_THROTTLE_COUNT) {
      this.isThrottled = true
      this.throttleTimer = setTimeout(() => {
        this.isThrottled = false
        this.dismissCount = 0
      }, AnnotationManager.THROTTLE_DURATION_MS)
    }
  }

  private sendAnnotation(command: AnnotationCommand, signal: AttentionSignal): void {
    const tab = this.getActiveTab()
    if (!tab) return

    this.lastAnnotationTime = Date.now()

    // Log to AIEventLog
    this.aiEventLog.log({
      id: command.id,
      timestamp: Date.now(),
      tabId: signal.tabId,
      type: 'annotation',
      trigger: { source: 'attention', signal },
      output: { model: 'local', content: command, latencyMs: 0 },
      disposition: 'pending',
    })

    // Send to tab's injected script
    tab.webContents.send('attention:command', command)
  }

  // For testing
  get isDismissThrottled(): boolean {
    return this.isThrottled
  }

  get currentDismissCount(): number {
    return this.dismissCount
  }
}

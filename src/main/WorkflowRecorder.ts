// src/main/WorkflowRecorder.ts
import { EventBus } from './EventBus'
import { RrwebRingBuffer } from './RrwebRingBuffer'

export interface WorkflowAction {
  step: number
  timestamp: number
  action: 'navigate' | 'click' | 'type' | 'scroll'
  data: {
    url?: string
    selector?: string
    label?: string
    value?: string
    position?: { x: number; y: number }
  }
}

export interface WorkflowRecording {
  id: string
  name?: string
  startTime: number
  endTime: number
  duration: number
  actions: WorkflowAction[]
  tabId: string
}

export class WorkflowRecorder {
  private eventBus: EventBus
  private ringBuffer: RrwebRingBuffer
  private recording = false
  private currentRecording: {
    startTime: number
    tabId: string
    actions: WorkflowAction[]
    stepCounter: number
  } | null = null

  constructor(eventBus: EventBus, ringBuffer: RrwebRingBuffer) {
    this.eventBus = eventBus
    this.ringBuffer = ringBuffer
  }

  startRecording(tabId: string): void {
    if (this.recording) return
    this.recording = true
    this.currentRecording = {
      startTime: Date.now(),
      tabId,
      actions: [],
      stepCounter: 0,
    }
    this.eventBus.on('rrweb:event', this.handleEvent)
  }

  stopRecording(): WorkflowRecording | null {
    if (!this.recording || !this.currentRecording) return null
    this.recording = false
    this.eventBus.off('rrweb:event', this.handleEvent)

    const endTime = Date.now()
    const recording: WorkflowRecording = {
      id: `wf-${this.currentRecording.startTime}`,
      startTime: this.currentRecording.startTime,
      endTime,
      duration: endTime - this.currentRecording.startTime,
      actions: this.currentRecording.actions,
      tabId: this.currentRecording.tabId,
    }

    this.currentRecording = null
    return recording
  }

  get isRecording(): boolean {
    return this.recording
  }

  get actionCount(): number {
    return this.currentRecording?.actions.length || 0
  }

  private handleEvent = (event: any): void => {
    if (!this.currentRecording || !event) return

    // Check for navigation (Meta event type 4)
    if (event.type === 4 && event.data?.href) {
      this.addAction({
        action: 'navigate',
        data: { url: event.data.href },
      }, event.timestamp)
      return
    }

    // Only process IncrementalSnapshot (type 3)
    if (event.type !== 3 || !event.data) return

    switch (event.data.source) {
      case 2: // MouseInteraction
        if (event.data.type === 2) { // Click
          this.addAction({
            action: 'click',
            data: {
              position: { x: event.data.x || 0, y: event.data.y || 0 },
              selector: event.data.id ? `[data-rrweb-id="${event.data.id}"]` : undefined,
            },
          }, event.timestamp)
        }
        break

      case 5: // Input
        this.addAction({
          action: 'type',
          data: {
            value: event.data.text || '',
            selector: event.data.id ? `[data-rrweb-id="${event.data.id}"]` : undefined,
          },
        }, event.timestamp)
        break
    }
  }

  private addAction(
    partial: { action: WorkflowAction['action']; data: WorkflowAction['data'] },
    timestamp: number
  ): void {
    if (!this.currentRecording) return

    // Deduplicate rapid type events (debounce 500ms)
    const lastAction = this.currentRecording.actions[this.currentRecording.actions.length - 1]
    if (
      lastAction &&
      lastAction.action === 'type' &&
      partial.action === 'type' &&
      lastAction.data.selector === partial.data.selector &&
      timestamp - lastAction.timestamp < 500
    ) {
      // Update the last type action instead of adding new one
      lastAction.data.value = partial.data.value
      lastAction.timestamp = timestamp
      return
    }

    this.currentRecording.actions.push({
      step: ++this.currentRecording.stepCounter,
      timestamp: timestamp || Date.now(),
      ...partial,
    })
  }

  // Generate AI summary of actions (returns a prompt for the LLM)
  generateSummaryPrompt(recording: WorkflowRecording): string {
    const lines = recording.actions.map((a) => {
      switch (a.action) {
        case 'navigate': return `Step ${a.step}: Navigated to ${a.data.url}`
        case 'click': return `Step ${a.step}: Clicked at (${a.data.position?.x}, ${a.data.position?.y})`
        case 'type': return `Step ${a.step}: Typed "${a.data.value?.substring(0, 50)}" into ${a.data.selector || 'field'}`
        case 'scroll': return `Step ${a.step}: Scrolled the page`
        default: return `Step ${a.step}: ${a.action}`
      }
    })
    return `Summarize this browser workflow in 2-3 sentences. What was the user trying to accomplish?\n\nActions:\n${lines.join('\n')}`
  }
}

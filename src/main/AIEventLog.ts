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

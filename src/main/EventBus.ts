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

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
    if (event._estimatedSize) return event._estimatedSize
    return JSON.stringify(event).length * 2
  }
}

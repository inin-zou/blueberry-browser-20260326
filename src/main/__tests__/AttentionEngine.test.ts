import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AttentionEngine, type AttentionSignal } from '../AttentionEngine'
import { EventBus } from '../EventBus'

describe('AttentionEngine', () => {
  let eventBus: EventBus
  let engine: AttentionEngine
  let signals: AttentionSignal[]

  beforeEach(() => {
    vi.useFakeTimers()
    eventBus = new EventBus()
    engine = new AttentionEngine(eventBus)
    signals = []
    eventBus.on('attention:detected', (signal) => signals.push(signal))
    engine.start()
  })

  afterEach(() => {
    engine.stop()
    vi.useRealTimers()
  })

  it('detects dwell when mouse stops for 3+ seconds', () => {
    // Emit a mouse move event
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 1, positions: [{ x: 100, y: 200, id: 1, timeOffset: 0 }] },
      timestamp: Date.now(),
    })

    // No signal yet
    expect(signals).toHaveLength(0)

    // Advance timer past dwell threshold
    vi.advanceTimersByTime(3100)

    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('dwell')
    expect(signals[0].intentGuess).toBe('confused')
  })

  it('does not emit dwell if mouse moves before threshold', () => {
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 1, positions: [{ x: 100, y: 200, id: 1, timeOffset: 0 }] },
      timestamp: Date.now(),
    })

    // Mouse moves again before threshold
    vi.advanceTimersByTime(1000)
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 1, positions: [{ x: 150, y: 250, id: 1, timeOffset: 0 }] },
      timestamp: Date.now(),
    })

    vi.advanceTimersByTime(3100)

    // Only one dwell signal (from second position), not from first
    expect(signals).toHaveLength(1)
  })

  it('detects tab switching as comparing intent', () => {
    const now = Date.now()
    // Simulate 3 rapid tab switches
    eventBus.emit('tab:switched', { tabId: 'tab-1', timestamp: now })

    // Need to advance past throttle
    vi.advanceTimersByTime(2100)
    eventBus.emit('tab:switched', { tabId: 'tab-2', timestamp: Date.now() })

    vi.advanceTimersByTime(2100)
    eventBus.emit('tab:switched', { tabId: 'tab-1', timestamp: Date.now() })

    const tabSignals = signals.filter((s) => s.type === 'tab_switch')
    expect(tabSignals.length).toBeGreaterThanOrEqual(1)
    expect(tabSignals[0].intentGuess).toBe('comparing')
  })

  it('detects slow scroll as interested', () => {
    const now = Date.now()

    // Simulate slow scroll (small delta, 1 second apart)
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 3, y: 100 },
      timestamp: now,
    })

    vi.advanceTimersByTime(2100) // past throttle

    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 3, y: 130 }, // 30px in ~2s = 15px/sec (slow)
      timestamp: Date.now(),
    })

    const scrollSignals = signals.filter((s) => s.type === 'scroll_slow')
    expect(scrollSignals.length).toBeGreaterThanOrEqual(1)
    expect(scrollSignals[0].intentGuess).toBe('interested')
  })

  it('throttles signals of the same type', () => {
    const now = Date.now()

    // Emit two scroll events rapidly
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 3, y: 100 },
      timestamp: now,
    })
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 3, y: 130 },
      timestamp: now + 1000,
    })
    // Should only emit one signal due to throttle
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 3, y: 135 },
      timestamp: now + 1500,
    })

    const scrollSignals = signals.filter((s) => s.type === 'scroll_slow')
    expect(scrollSignals.length).toBeLessThanOrEqual(1)
  })

  it('stops emitting signals after stop()', () => {
    engine.stop()

    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 1, positions: [{ x: 100, y: 200, id: 1, timeOffset: 0 }] },
      timestamp: Date.now(),
    })

    vi.advanceTimersByTime(5000)
    expect(signals).toHaveLength(0)
  })

  it('handles malformed events gracefully', () => {
    // Should not throw
    eventBus.emit('rrweb:event', null)
    eventBus.emit('rrweb:event', {})
    eventBus.emit('rrweb:event', { type: 3 })
    eventBus.emit('rrweb:event', { type: 3, data: {} })
    expect(signals).toHaveLength(0)
  })
})

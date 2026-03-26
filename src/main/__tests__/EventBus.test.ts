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

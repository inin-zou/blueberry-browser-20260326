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
    const buf = new RrwebRingBuffer(250)
    buf.push(makeEvent(1000, 100))
    buf.push(makeEvent(2000, 100))
    buf.push(makeEvent(3000, 100))
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

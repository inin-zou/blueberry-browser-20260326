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
    expect(log.getAll()[0].id).toBe('2')
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

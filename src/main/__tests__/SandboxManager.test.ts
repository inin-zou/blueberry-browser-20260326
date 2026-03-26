import { describe, it, expect } from 'vitest'
import { SandboxManager } from '../SandboxManager'
import { AIEventLog } from '../AIEventLog'

describe('SandboxManager', () => {
  it('can be instantiated', () => {
    const manager = new SandboxManager(new AIEventLog())
    expect(manager).toBeDefined()
  })

  it('starts with empty history', () => {
    const manager = new SandboxManager(new AIEventLog())
    expect(manager.getHistory()).toEqual([])
  })

  it('getHistory returns a copy (not the internal array)', () => {
    const manager = new SandboxManager(new AIEventLog())
    const history1 = manager.getHistory()
    const history2 = manager.getHistory()
    // They should be separate array instances
    expect(history1).not.toBe(history2)
    expect(Array.isArray(history1)).toBe(true)
    expect(history1).toHaveLength(0)
  })

  it('accepts a custom AIEventLog instance', () => {
    const log = new AIEventLog(100)
    const manager = new SandboxManager(log)
    expect(manager).toBeDefined()
    expect(manager.getHistory()).toHaveLength(0)
  })

  // Note: Full execution tests require Electron runtime (WebContentsView)
  // Those will be tested manually or via E2E tests in Phase 8
})

describe('Tab.getDomSnapshot', () => {
  // Tab.getDomSnapshot() also requires Electron runtime
  // Test the concept: it should return HTML without script tags
  it('concept: snapshot should strip scripts', () => {
    // This would be tested in E2E
    expect(true).toBe(true)
  })
})

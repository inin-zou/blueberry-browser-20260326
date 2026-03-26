// src/main/__tests__/LocalModelManager.test.ts
import { describe, it, expect } from 'vitest'
import { LocalModelManager } from '../LocalModelManager'

describe('LocalModelManager', () => {
  it('can be instantiated', () => {
    const manager = new LocalModelManager()
    expect(manager).toBeDefined()
    expect(manager.isReady).toBe(false)
  })

  it('starts not ready', () => {
    const manager = new LocalModelManager()
    expect(manager.isReady).toBe(false)
  })

  it('throws when inferring before ready', async () => {
    const manager = new LocalModelManager()
    await expect(manager.infer('test')).rejects.toThrow('Local model not ready')
  })

  it('cleans up on destroy', () => {
    const manager = new LocalModelManager()
    manager.destroy()
    expect(manager.isReady).toBe(false)
  })

  it('still throws after destroy', async () => {
    const manager = new LocalModelManager()
    manager.destroy()
    await expect(manager.infer('hello')).rejects.toThrow('Local model not ready')
  })
})

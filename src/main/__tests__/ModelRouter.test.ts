// src/main/__tests__/ModelRouter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ModelRouter } from '../ModelRouter'

describe('ModelRouter', () => {
  it('routes fast tasks to local model when available', async () => {
    const localInfer = vi.fn().mockResolvedValue({ result: 'local-result', confidence: 0.9 })
    const cloudInfer = vi.fn()
    const router = new ModelRouter({ localInfer, cloudInfer })

    const result = await router.infer({
      task: 'completion',
      input: { text: 'hello' },
      latencyBudget: 'fast',
    })
    expect(result.model).toBe('local')
    expect(result.result).toBe('local-result')
    expect(localInfer).toHaveBeenCalled()
    expect(cloudInfer).not.toHaveBeenCalled()
  })

  it('routes normal tasks to cloud model', async () => {
    const localInfer = vi.fn()
    const cloudInfer = vi.fn().mockResolvedValue({ result: 'cloud-result', confidence: 0.95 })
    const router = new ModelRouter({ localInfer, cloudInfer })

    const result = await router.infer({
      task: 'synthesize',
      input: { text: 'compare these' },
      latencyBudget: 'normal',
    })
    expect(result.model).toBe('cloud')
    expect(result.result).toBe('cloud-result')
    expect(cloudInfer).toHaveBeenCalled()
  })

  it('falls back to cloud when local is unavailable', async () => {
    const cloudInfer = vi.fn().mockResolvedValue({ result: 'fallback', confidence: 0.9 })
    const router = new ModelRouter({ localInfer: null, cloudInfer })

    const result = await router.infer({
      task: 'completion',
      input: { text: 'hello' },
      latencyBudget: 'fast',
    })
    expect(result.model).toBe('cloud')
  })

  it('falls back to cloud when local confidence is below threshold', async () => {
    const localInfer = vi.fn().mockResolvedValue({ result: 'unsure', confidence: 0.3 })
    const cloudInfer = vi.fn().mockResolvedValue({ result: 'sure', confidence: 0.9 })
    const router = new ModelRouter({ localInfer, cloudInfer })

    const result = await router.infer({
      task: 'completion',
      input: { text: 'hello' },
      latencyBudget: 'fast',
      confidenceThreshold: 0.5,
    })
    expect(result.model).toBe('cloud')
    expect(result.result).toBe('sure')
  })

  it('falls back to cloud when local throws', async () => {
    const localInfer = vi.fn().mockRejectedValue(new Error('model busy'))
    const cloudInfer = vi.fn().mockResolvedValue({ result: 'cloud-fallback', confidence: 0.8 })
    const router = new ModelRouter({ localInfer, cloudInfer })

    const result = await router.infer({
      task: 'completion',
      input: { text: 'hello' },
      latencyBudget: 'fast',
    })
    expect(result.model).toBe('cloud')
  })

  it('tracks latency in response', async () => {
    const cloudInfer = vi.fn().mockResolvedValue({ result: 'ok', confidence: 0.9 })
    const router = new ModelRouter({ localInfer: null, cloudInfer })

    const result = await router.infer({
      task: 'completion',
      input: { text: 'hello' },
      latencyBudget: 'normal',
    })
    expect(result.latencyMs).toBeDefined()
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('setLocalInfer updates the local model', async () => {
    const cloudInfer = vi.fn().mockResolvedValue({ result: 'cloud', confidence: 0.9 })
    const router = new ModelRouter({ localInfer: null, cloudInfer })

    // Initially no local model — routes to cloud
    await router.infer({ task: 'completion', input: { text: 'a' }, latencyBudget: 'fast' })
    expect(cloudInfer).toHaveBeenCalledOnce()

    // Add local model
    const localInfer = vi.fn().mockResolvedValue({ result: 'local', confidence: 0.9 })
    router.setLocalInfer(localInfer)

    const result = await router.infer({ task: 'completion', input: { text: 'b' }, latencyBudget: 'fast' })
    expect(result.model).toBe('local')
  })
})

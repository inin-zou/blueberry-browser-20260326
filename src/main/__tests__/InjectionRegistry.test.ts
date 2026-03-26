import { describe, it, expect, vi } from 'vitest'
import { InjectionRegistry } from '../InjectionRegistry'

const createMockTab = () => ({
  id: 'tab-1',
  runJs: vi.fn().mockResolvedValue(undefined),
  webContents: {
    on: vi.fn(),
    removeListener: vi.fn(),
  },
})

describe('InjectionRegistry', () => {
  it('registers and injects scripts into a tab', async () => {
    const registry = new InjectionRegistry()
    const tab = createMockTab()
    registry.register('test-script', 'console.log("hello")')
    await registry.injectAll(tab as any)
    expect(tab.runJs).toHaveBeenCalledWith('console.log("hello")')
  })

  it('injects scripts in dependency order', async () => {
    const registry = new InjectionRegistry()
    const tab = createMockTab()
    const callOrder: string[] = []
    tab.runJs.mockImplementation((code: string) => {
      callOrder.push(code)
      return Promise.resolve()
    })

    registry.register('script-b', 'B', { dependencies: ['script-a'] })
    registry.register('script-a', 'A')

    await registry.injectAll(tab as any)
    expect(callOrder).toEqual(['A', 'B'])
  })

  it('does not inject the same script twice in a single injectAll call', async () => {
    const registry = new InjectionRegistry()
    const tab = createMockTab()
    registry.register('once', 'console.log("once")')
    await registry.injectAll(tab as any)
    expect(tab.runJs).toHaveBeenCalledTimes(1)
  })

  it('re-injects on subsequent injectAll calls (for navigation)', async () => {
    const registry = new InjectionRegistry()
    const tab = createMockTab()
    registry.register('script', 'code')
    await registry.injectAll(tab as any)
    await registry.injectAll(tab as any)
    expect(tab.runJs).toHaveBeenCalledTimes(2)
  })

  it('removes a registered script', async () => {
    const registry = new InjectionRegistry()
    registry.register('removable', 'code')
    registry.unregister('removable')
    const tab = createMockTab()
    await registry.injectAll(tab as any)
    expect(tab.runJs).not.toHaveBeenCalled()
  })

  it('handles injection errors gracefully', async () => {
    const registry = new InjectionRegistry()
    const tab = createMockTab()
    tab.runJs.mockRejectedValueOnce(new Error('injection failed'))
    registry.register('failing', 'bad code')
    registry.register('after', 'good code')
    await registry.injectAll(tab as any)
    // Should still try to inject the second script
    expect(tab.runJs).toHaveBeenCalledTimes(2)
  })
})

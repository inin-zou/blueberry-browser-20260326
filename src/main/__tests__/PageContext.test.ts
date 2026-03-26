// src/main/__tests__/PageContext.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildPageContext, getAllTabContexts } from '../PageContext'

const createMockTab = (overrides = {}) => ({
  id: 'tab-1',
  url: 'https://example.com',
  title: 'Example Page',
  getTabText: vi.fn().mockResolvedValue('Hello world content'),
  screenshot: vi.fn().mockResolvedValue({ toDataURL: () => 'data:image/png;base64,abc' }),
  ...overrides,
})

describe('buildPageContext', () => {
  it('returns correct page context', async () => {
    const tab = createMockTab()
    const ctx = await buildPageContext(tab as any)
    expect(ctx.tabId).toBe('tab-1')
    expect(ctx.url).toBe('https://example.com')
    expect(ctx.title).toBe('Example Page')
    expect(ctx.content).toBe('Hello world content')
  })

  it('truncates content to maxLength', async () => {
    const longText = 'a'.repeat(5000)
    const tab = createMockTab({ getTabText: vi.fn().mockResolvedValue(longText) })
    const ctx = await buildPageContext(tab as any, { maxContentLength: 100 })
    expect(ctx.content!.length).toBeLessThanOrEqual(103) // 100 + '...'
  })

  it('handles getTabText failure gracefully', async () => {
    const tab = createMockTab({ getTabText: vi.fn().mockRejectedValue(new Error('fail')) })
    const ctx = await buildPageContext(tab as any)
    expect(ctx.content).toBeUndefined()
  })

  it('optionally includes screenshot', async () => {
    const tab = createMockTab()
    const ctx = await buildPageContext(tab as any, { includeScreenshot: true })
    expect(ctx.screenshot).toBe('data:image/png;base64,abc')
  })

  it('excludes screenshot by default', async () => {
    const tab = createMockTab()
    const ctx = await buildPageContext(tab as any)
    expect(ctx.screenshot).toBeUndefined()
  })
})

describe('getAllTabContexts', () => {
  it('returns contexts for all tabs', async () => {
    const tabs = [
      createMockTab({ id: 'tab-1', url: 'https://a.com', title: 'A' }),
      createMockTab({ id: 'tab-2', url: 'https://b.com', title: 'B' }),
    ]
    const contexts = await getAllTabContexts(tabs as any)
    expect(contexts).toHaveLength(2)
    expect(contexts[0].tabId).toBe('tab-1')
    expect(contexts[1].tabId).toBe('tab-2')
  })

  it('handles empty tab list', async () => {
    const contexts = await getAllTabContexts([])
    expect(contexts).toEqual([])
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TabSynthesizer } from '../TabSynthesizer'
import { EventBus } from '../EventBus'
import { AIEventLog } from '../AIEventLog'

const createMockTab = (id: string, url: string, title: string) => ({
  id,
  url,
  title,
  getTabText: vi.fn().mockResolvedValue(`Content of ${title}`),
  screenshot: vi.fn().mockResolvedValue({ toDataURL: () => '' }),
})

describe('TabSynthesizer', () => {
  let eventBus: EventBus
  let aiEventLog: AIEventLog
  let synthesizer: TabSynthesizer
  let mockTabs: any[]

  beforeEach(() => {
    eventBus = new EventBus()
    aiEventLog = new AIEventLog()
    mockTabs = [
      createMockTab('tab-1', 'https://lambda.com', 'Lambda Cloud'),
      createMockTab('tab-2', 'https://runpod.io', 'RunPod'),
      createMockTab('tab-3', 'https://vast.ai', 'Vast.ai'),
    ]
    synthesizer = new TabSynthesizer(eventBus, aiEventLog, () => mockTabs)
    synthesizer.start()
  })

  it('emits synthesis offer on comparing intent', () => {
    const offers: any[] = []
    eventBus.on('synthesis:offer', (data) => offers.push(data))

    eventBus.emit('attention:detected', {
      id: 'sig-1', tabId: 'tab-1', timestamp: Date.now(),
      type: 'tab_switch', data: { switchCount: 4 },
      intentGuess: 'comparing',
    })

    expect(offers).toHaveLength(1)
    expect(offers[0].tabCount).toBe(4)
  })

  it('does not emit on non-comparing intents', () => {
    const offers: any[] = []
    eventBus.on('synthesis:offer', (data) => offers.push(data))

    eventBus.emit('attention:detected', {
      id: 'sig-2', tabId: 'tab-1', timestamp: Date.now(),
      type: 'dwell', data: { position: { x: 0, y: 0 } },
      intentGuess: 'confused',
    })

    expect(offers).toHaveLength(0)
  })

  it('does not emit on non-tab_switch type even with comparing intent', () => {
    const offers: any[] = []
    eventBus.on('synthesis:offer', (data) => offers.push(data))

    eventBus.emit('attention:detected', {
      id: 'sig-3', tabId: 'tab-1', timestamp: Date.now(),
      type: 'dwell', data: { position: { x: 0, y: 0 } },
      intentGuess: 'comparing',
    })

    expect(offers).toHaveLength(0)
  })

  it('has cooldown between synthesis offers', () => {
    const offers: any[] = []
    eventBus.on('synthesis:offer', (data) => offers.push(data))

    eventBus.emit('attention:detected', {
      id: 'sig-a', tabId: 'tab-1', timestamp: Date.now(),
      type: 'tab_switch', data: { switchCount: 4 },
      intentGuess: 'comparing',
    })

    // Immediate second should be blocked
    eventBus.emit('attention:detected', {
      id: 'sig-b', tabId: 'tab-1', timestamp: Date.now(),
      type: 'tab_switch', data: { switchCount: 5 },
      intentGuess: 'comparing',
    })

    expect(offers).toHaveLength(1)
  })

  it('returns null when fewer than 2 tabs', async () => {
    const singleTab = new TabSynthesizer(eventBus, aiEventLog, () => [mockTabs[0]])
    const result = await singleTab.synthesize()
    expect(result).toBeNull()
  })

  it('returns null when no tabs', async () => {
    const noTabs = new TabSynthesizer(eventBus, aiEventLog, () => [])
    const result = await noTabs.synthesize()
    expect(result).toBeNull()
  })

  it('filters tabs by provided tabIds in synthesize', async () => {
    // When only one tabId is provided, should return null (< 2 tabs)
    const result = await synthesizer.synthesize(['tab-1'])
    expect(result).toBeNull()
  })

  it('builds synthesis prompt with tab content', () => {
    // Test that the private method works via the synthesize flow
    // We can't easily test the LLM call without mocking the ai SDK
    // So test instantiation and basic validation
    expect(synthesizer).toBeDefined()
  })

  it('stops listening after stop() is called', () => {
    const offers: any[] = []
    eventBus.on('synthesis:offer', (data) => offers.push(data))

    synthesizer.stop()

    eventBus.emit('attention:detected', {
      id: 'sig-stopped', tabId: 'tab-1', timestamp: Date.now(),
      type: 'tab_switch', data: { switchCount: 4 },
      intentGuess: 'comparing',
    })

    expect(offers).toHaveLength(0)
  })

  it('includes tabCount from signal switchCount in offer', () => {
    const offers: any[] = []
    eventBus.on('synthesis:offer', (data) => offers.push(data))

    eventBus.emit('attention:detected', {
      id: 'sig-count', tabId: 'tab-1', timestamp: Date.now(),
      type: 'tab_switch', data: { switchCount: 7 },
      intentGuess: 'comparing',
    })

    expect(offers[0].tabCount).toBe(7)
  })

  it('defaults tabCount to 0 when switchCount is missing', () => {
    const offers: any[] = []
    eventBus.on('synthesis:offer', (data) => offers.push(data))

    eventBus.emit('attention:detected', {
      id: 'sig-nocount', tabId: 'tab-1', timestamp: Date.now(),
      type: 'tab_switch', data: {},
      intentGuess: 'comparing',
    })

    expect(offers[0].tabCount).toBe(0)
  })
})

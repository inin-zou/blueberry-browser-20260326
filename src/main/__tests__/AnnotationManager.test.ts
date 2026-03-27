import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnnotationManager } from '../AnnotationManager'
import { EventBus } from '../EventBus'
import { AIEventLog } from '../AIEventLog'

describe('AnnotationManager', () => {
  let eventBus: EventBus
  let aiEventLog: AIEventLog
  let manager: AnnotationManager
  let mockTab: any

  beforeEach(() => {
    eventBus = new EventBus()
    aiEventLog = new AIEventLog()
    mockTab = { webContents: { send: vi.fn() } }
    manager = new AnnotationManager(eventBus, aiEventLog, () => mockTab)
    manager.setEnabled(true)
    manager.start()
  })

  it('sends highlight annotation on dwell/confused signal', () => {
    eventBus.emit('attention:detected', {
      id: 'sig-1', tabId: 'tab-1', timestamp: Date.now(),
      type: 'dwell', data: { position: { x: 100, y: 200 }, durationMs: 3000 },
      intentGuess: 'confused',
    })
    expect(mockTab.webContents.send).toHaveBeenCalledWith('attention:command', expect.objectContaining({ type: 'highlight' }))
  })

  it('does not annotate on non-confused intents', () => {
    eventBus.emit('attention:detected', {
      id: 'sig-2', tabId: 'tab-1', timestamp: Date.now(),
      type: 'scroll_slow', data: { scrollVelocity: 30 },
      intentGuess: 'interested',
    })
    expect(mockTab.webContents.send).not.toHaveBeenCalled()
  })

  it('throttles after 3 dismissals', () => {
    // Trigger 3 annotations and dismiss each
    for (let i = 0; i < 3; i++) {
      // Need time gap for MIN_INTERVAL
      manager['lastAnnotationTime'] = 0
      eventBus.emit('attention:detected', {
        id: `sig-${i}`, tabId: 'tab-1', timestamp: Date.now(),
        type: 'dwell', data: { position: { x: 100, y: 200 } },
        intentGuess: 'confused',
      })
      eventBus.emit('annotation:dismissed', { annotationId: `ann-${i}` })
    }
    expect(manager.isDismissThrottled).toBe(true)

    // Next annotation should be suppressed
    mockTab.webContents.send.mockClear()
    manager['lastAnnotationTime'] = 0
    eventBus.emit('attention:detected', {
      id: 'sig-throttled', tabId: 'tab-1', timestamp: Date.now(),
      type: 'dwell', data: { position: { x: 100, y: 200 } },
      intentGuess: 'confused',
    })
    expect(mockTab.webContents.send).not.toHaveBeenCalled()
  })

  it('respects minimum interval between annotations', () => {
    eventBus.emit('attention:detected', {
      id: 'sig-a', tabId: 'tab-1', timestamp: Date.now(),
      type: 'dwell', data: { position: { x: 100, y: 200 } },
      intentGuess: 'confused',
    })
    expect(mockTab.webContents.send).toHaveBeenCalledOnce()

    // Immediately emit another — should be suppressed
    eventBus.emit('attention:detected', {
      id: 'sig-b', tabId: 'tab-1', timestamp: Date.now(),
      type: 'dwell', data: { position: { x: 300, y: 400 } },
      intentGuess: 'confused',
    })
    expect(mockTab.webContents.send).toHaveBeenCalledOnce() // still just 1
  })

  it('logs annotations to AIEventLog', () => {
    eventBus.emit('attention:detected', {
      id: 'sig-log', tabId: 'tab-1', timestamp: Date.now(),
      type: 'dwell', data: { position: { x: 100, y: 200 } },
      intentGuess: 'confused',
    })
    const events = aiEventLog.getByType('annotation')
    expect(events).toHaveLength(1)
    expect(events[0].trigger.source).toBe('attention')
  })

  it('does not annotate when no active tab', () => {
    // Stop the main manager so only noTabManager is listening
    manager.stop()
    const noTabManager = new AnnotationManager(eventBus, aiEventLog, () => null)
    noTabManager.start()
    eventBus.emit('attention:detected', {
      id: 'sig-notab', tabId: 'tab-1', timestamp: Date.now(),
      type: 'dwell', data: { position: { x: 100, y: 200 } },
      intentGuess: 'confused',
    })
    // No crash, no send
    expect(mockTab.webContents.send).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowRecorder } from '../WorkflowRecorder'
import { EventBus } from '../EventBus'
import { RrwebRingBuffer } from '../RrwebRingBuffer'

describe('WorkflowRecorder', () => {
  let eventBus: EventBus
  let ringBuffer: RrwebRingBuffer
  let recorder: WorkflowRecorder

  beforeEach(() => {
    eventBus = new EventBus()
    ringBuffer = new RrwebRingBuffer()
    recorder = new WorkflowRecorder(eventBus, ringBuffer)
  })

  it('starts and stops recording', () => {
    recorder.startRecording('tab-1')
    expect(recorder.isRecording).toBe(true)
    const recording = recorder.stopRecording()
    expect(recorder.isRecording).toBe(false)
    expect(recording).not.toBeNull()
    expect(recording!.tabId).toBe('tab-1')
  })

  it('captures click events', () => {
    recorder.startRecording('tab-1')
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 2, type: 2, x: 100, y: 200, id: 42 },
      timestamp: Date.now(),
    })
    const recording = recorder.stopRecording()
    expect(recording!.actions).toHaveLength(1)
    expect(recording!.actions[0].action).toBe('click')
    expect(recording!.actions[0].data.position).toEqual({ x: 100, y: 200 })
  })

  it('captures input/type events', () => {
    recorder.startRecording('tab-1')
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 5, text: 'hello world', id: 10 },
      timestamp: Date.now(),
    })
    const recording = recorder.stopRecording()
    expect(recording!.actions).toHaveLength(1)
    expect(recording!.actions[0].action).toBe('type')
    expect(recording!.actions[0].data.value).toBe('hello world')
  })

  it('deduplicates rapid type events', () => {
    recorder.startRecording('tab-1')
    const now = Date.now()
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 5, text: 'h', id: 10 },
      timestamp: now,
    })
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 5, text: 'he', id: 10 },
      timestamp: now + 100,
    })
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 5, text: 'hel', id: 10 },
      timestamp: now + 200,
    })
    const recording = recorder.stopRecording()
    expect(recording!.actions).toHaveLength(1) // deduplicated
    expect(recording!.actions[0].data.value).toBe('hel')
  })

  it('returns null when stopping without starting', () => {
    expect(recorder.stopRecording()).toBeNull()
  })

  it('ignores events when not recording', () => {
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 2, type: 2, x: 100, y: 200 },
      timestamp: Date.now(),
    })
    recorder.startRecording('tab-1')
    const recording = recorder.stopRecording()
    expect(recording!.actions).toHaveLength(0)
  })

  it('ignores non-incremental-snapshot events', () => {
    recorder.startRecording('tab-1')
    eventBus.emit('rrweb:event', { type: 1, data: {}, timestamp: Date.now() }) // Load event
    eventBus.emit('rrweb:event', { type: 2, data: {}, timestamp: Date.now() }) // FullSnapshot
    const recording = recorder.stopRecording()
    expect(recording!.actions).toHaveLength(0)
  })

  it('generates summary prompt', () => {
    recorder.startRecording('tab-1')
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 2, type: 2, x: 100, y: 200 },
      timestamp: Date.now(),
    })
    const recording = recorder.stopRecording()!
    const prompt = recorder.generateSummaryPrompt(recording)
    expect(prompt).toContain('Step 1')
    expect(prompt).toContain('Clicked')
  })

  it('tracks action count during recording', () => {
    recorder.startRecording('tab-1')
    expect(recorder.actionCount).toBe(0)
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 2, type: 2, x: 100, y: 200 },
      timestamp: Date.now(),
    })
    expect(recorder.actionCount).toBe(1)
    recorder.stopRecording()
  })

  it('prevents double start', () => {
    recorder.startRecording('tab-1')
    recorder.startRecording('tab-2') // should be ignored
    eventBus.emit('rrweb:event', {
      type: 3,
      data: { source: 2, type: 2, x: 100, y: 200 },
      timestamp: Date.now(),
    })
    const recording = recorder.stopRecording()
    expect(recording!.tabId).toBe('tab-1') // first start wins
  })

  it('calculates duration', () => {
    recorder.startRecording('tab-1')
    const recording = recorder.stopRecording()
    expect(recording!.duration).toBeGreaterThanOrEqual(0)
    expect(recording!.startTime).toBeLessThanOrEqual(recording!.endTime)
  })
})

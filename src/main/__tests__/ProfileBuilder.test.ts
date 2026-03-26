import { describe, it, expect } from 'vitest'
import { ProfileBuilder } from '../ProfileBuilder'
import type { RawHistoryEntry } from '../HistoryImporter'

const makeEntry = (url: string, visitCount = 1, title = ''): RawHistoryEntry => ({
  url, title: title || url, visitCount, lastVisited: Date.now(),
})

describe('ProfileBuilder', () => {
  it('extracts top domains from history', () => {
    const builder = new ProfileBuilder()
    const entries = [
      makeEntry('https://github.com/repo1', 50),
      makeEntry('https://github.com/repo2', 30),
      makeEntry('https://google.com/search', 10),
    ]
    const profile = builder.build(entries, ['chrome'])
    expect(profile.topDomains[0].domain).toBe('github.com')
    expect(profile.topDomains[0].visitCount).toBe(80)
  })

  it('clusters domains into topics', () => {
    const builder = new ProfileBuilder()
    const entries = [
      makeEntry('https://github.com/test', 100),
      makeEntry('https://stackoverflow.com/q/123', 50),
      makeEntry('https://openai.com/docs', 30),
      makeEntry('https://huggingface.co/models', 20),
    ]
    const profile = builder.build(entries, ['chrome'])
    const topics = profile.topicClusters.map((c) => c.topic)
    expect(topics).toContain('Development')
    expect(topics).toContain('AI/ML')
  })

  it('infers interests from topic clusters', () => {
    const builder = new ProfileBuilder()
    const entries = [
      makeEntry('https://github.com/test', 100),
      makeEntry('https://youtube.com/watch', 200),
    ]
    const profile = builder.build(entries, ['chrome'])
    expect(profile.inferredInterests.length).toBeGreaterThan(0)
  })

  it('handles empty entries', () => {
    const builder = new ProfileBuilder()
    const profile = builder.build([], ['chrome'])
    expect(profile.topDomains).toEqual([])
    expect(profile.topicClusters).toEqual([])
    expect(profile.inferredInterests).toEqual([])
  })

  it('handles invalid URLs gracefully', () => {
    const builder = new ProfileBuilder()
    const entries = [
      makeEntry('not-a-url', 10),
      makeEntry('https://valid.com', 5),
    ]
    const profile = builder.build(entries, ['chrome'])
    expect(profile.topDomains).toHaveLength(1)
    expect(profile.topDomains[0].domain).toBe('valid.com')
  })

  it('converts entries to UrlCompletions', () => {
    const builder = new ProfileBuilder()
    const entries = [makeEntry('https://github.com/test', 10, 'GitHub')]
    const completions = builder.toUrlCompletions(entries)
    expect(completions).toHaveLength(1)
    expect(completions[0].domain).toBe('github.com')
    expect(completions[0].visitCount).toBe(10)
  })

  it('strips www from domains', () => {
    const builder = new ProfileBuilder()
    const entries = [makeEntry('https://www.github.com/test', 10)]
    const profile = builder.build(entries, ['chrome'])
    expect(profile.topDomains[0].domain).toBe('github.com')
  })

  it('records import metadata', () => {
    const builder = new ProfileBuilder()
    const profile = builder.build([makeEntry('https://test.com', 1)], ['chrome', 'safari'])
    expect(profile.browsers).toEqual(['chrome', 'safari'])
    expect(profile.importedAt).toBeGreaterThan(0)
  })
})

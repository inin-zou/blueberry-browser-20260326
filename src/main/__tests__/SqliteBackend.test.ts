import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SqliteBackend } from '../SqliteBackend'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'

const TEST_DB = join(__dirname, 'test-blueberry.db')

describe('SqliteBackend', () => {
  let backend: SqliteBackend

  beforeEach(() => {
    backend = new SqliteBackend(TEST_DB)
  })

  afterEach(() => {
    backend.close()
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  })

  it('saves and retrieves a workflow', async () => {
    const workflow = {
      id: 'wf-1',
      name: 'Test Workflow',
      createdAt: Date.now(),
      durationMs: 5000,
      actionsJson: JSON.stringify([{ step: 1, action: 'navigate' }]),
      summary: 'A test workflow',
    }
    await backend.saveWorkflow(workflow)
    const workflows = await backend.getWorkflows()
    expect(workflows).toHaveLength(1)
    expect(workflows[0].id).toBe('wf-1')
    expect(workflows[0].name).toBe('Test Workflow')
  })

  it('deletes a workflow', async () => {
    await backend.saveWorkflow({
      id: 'wf-del',
      name: 'Delete Me',
      createdAt: Date.now(),
      durationMs: 0,
      actionsJson: '[]',
    })
    await backend.deleteWorkflow('wf-del')
    expect(await backend.getWorkflows()).toHaveLength(0)
  })

  it('saves and searches URLs', async () => {
    await backend.saveUrls([
      { url: 'https://github.com/test', title: 'GitHub', visitCount: 5, lastVisited: Date.now(), domain: 'github.com' },
      { url: 'https://google.com', title: 'Google', visitCount: 10, lastVisited: Date.now(), domain: 'google.com' },
    ])
    const results = await backend.searchUrls('git')
    expect(results).toHaveLength(1)
    expect(results[0].domain).toBe('github.com')
  })

  it('saves and retrieves user profile', async () => {
    await backend.saveProfile({ key: 'interests', value: ['AI', 'web'] })
    const profile = await backend.getProfile('interests')
    expect(profile).toEqual({ key: 'interests', value: ['AI', 'web'] })
  })

  it('returns null for missing profile key', async () => {
    const profile = await backend.getProfile('nonexistent')
    expect(profile).toBeNull()
  })

  it('saves and retrieves scripts', async () => {
    await backend.saveScript({
      id: 'script-1',
      name: 'Extract Prices',
      prompt: 'get all prices',
      script: 'document.querySelectorAll(".price")',
      sourceUrlPattern: '%amazon.com%',
      createdAt: Date.now(),
      useCount: 0,
    })
    const scripts = await backend.getScriptsForUrl('https://amazon.com/products')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].name).toBe('Extract Prices')
  })

  it('deletes a script', async () => {
    await backend.saveScript({
      id: 'script-del',
      name: 'Delete Me',
      prompt: 'test',
      script: 'code',
      createdAt: Date.now(),
      useCount: 0,
    })
    await backend.deleteScript('script-del')
    const scripts = await backend.getScriptsForUrl('anything')
    expect(scripts).toHaveLength(0)
  })
})

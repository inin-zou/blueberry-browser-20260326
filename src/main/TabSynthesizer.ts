// src/main/TabSynthesizer.ts
import { EventBus } from './EventBus'
import { AIEventLog } from './AIEventLog'
import { getAllTabContexts, type PageContext } from './PageContext'
import type { AttentionSignal } from './AttentionEngine'
import type { Tab } from './Tab'

export interface SynthesisResult {
  id: string
  type: 'comparison'
  sourceTabs: { id: string; url: string; title: string }[]
  comparisonTable: {
    headers: string[]
    rows: { label: string; values: string[] }[]
  }
  recommendation: string
  timestamp: number
}

export class TabSynthesizer {
  private eventBus: EventBus
  private aiEventLog: AIEventLog
  private getAllTabs: () => Tab[]
  private lastSynthesisTime = 0
  private static readonly COOLDOWN_MS = 30000 // 30s between syntheses

  constructor(eventBus: EventBus, aiEventLog: AIEventLog, getAllTabs: () => Tab[]) {
    this.eventBus = eventBus
    this.aiEventLog = aiEventLog
    this.getAllTabs = getAllTabs
  }

  start(): void {
    this.eventBus.on('attention:detected', this.handleAttention)
  }

  stop(): void {
    this.eventBus.off('attention:detected', this.handleAttention)
  }

  private handleAttention = (signal: AttentionSignal): void => {
    if (signal.intentGuess !== 'comparing' || signal.type !== 'tab_switch') return

    const now = Date.now()
    if (now - this.lastSynthesisTime < TabSynthesizer.COOLDOWN_MS) return
    this.lastSynthesisTime = now

    // Emit an offer to synthesize (sidebar will show a prompt)
    this.eventBus.emit('synthesis:offer', {
      tabCount: signal.data.switchCount || 0,
      timestamp: now,
    })
  }

  async synthesize(tabIds?: string[]): Promise<SynthesisResult | null> {
    const tabs = this.getAllTabs()
    const targetTabs = tabIds
      ? tabs.filter((t) => tabIds.includes(t.id))
      : tabs.slice(0, 5) // default: all tabs, max 5

    if (targetTabs.length < 2) return null

    // Extract content from all target tabs
    const contexts = await getAllTabContexts(targetTabs, { maxContentLength: 2000 })
    if (contexts.length < 2) return null

    // Build synthesis prompt
    const prompt = this.buildSynthesisPrompt(contexts)

    try {
      const { streamText } = await import('ai')
      const { anthropic } = await import('@ai-sdk/anthropic')

      const result = await streamText({
        model: anthropic('claude-sonnet-4-6'),
        messages: [
          {
            role: 'system',
            content: `You are a comparison analyst. Given content from multiple web pages, create a structured comparison. Respond in valid JSON with this exact format:
{
  "headers": ["Feature", "Page1Title", "Page2Title", ...],
  "rows": [
    {"label": "Category Name", "values": ["value1", "value2", ...]},
    ...
  ],
  "recommendation": "Brief recommendation text"
}
Identify the most important comparison dimensions. Keep values concise (under 20 words each). Include 4-8 rows.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 1500,
      })

      let response = ''
      for await (const chunk of result.textStream) {
        response += chunk
      }

      // Parse JSON response
      const parsed = this.parseResponse(response, contexts)
      if (!parsed) return null

      const synthesisResult: SynthesisResult = {
        id: `syn-${Date.now()}`,
        type: 'comparison',
        sourceTabs: targetTabs.map((t) => ({ id: t.id, url: t.url, title: t.title })),
        comparisonTable: parsed,
        recommendation: parsed.recommendation || '',
        timestamp: Date.now(),
      }

      // Log to AIEventLog
      this.aiEventLog.log({
        id: synthesisResult.id,
        timestamp: Date.now(),
        tabId: targetTabs[0].id,
        type: 'synthesis',
        trigger: { source: 'tab-switch' },
        output: { model: 'cloud', content: synthesisResult, latencyMs: 0 },
        disposition: 'pending',
      })

      return synthesisResult
    } catch (err) {
      console.error('TabSynthesizer error:', err)
      return null
    }
  }

  private buildSynthesisPrompt(contexts: PageContext[]): string {
    const parts = ['Compare the following web pages:\n']
    for (const ctx of contexts) {
      parts.push(`--- Page: ${ctx.title} (${ctx.url}) ---`)
      parts.push(ctx.content || 'No content available')
      parts.push('')
    }
    parts.push('Create a structured comparison table identifying key differences and similarities.')
    return parts.join('\n')
  }

  private parseResponse(
    response: string,
    contexts: PageContext[]
  ): (SynthesisResult['comparisonTable'] & { recommendation: string }) | null {
    try {
      // Try to extract JSON from response (may have markdown code fences)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      const parsed = JSON.parse(jsonMatch[0])
      return {
        headers: parsed.headers || ['Feature', ...contexts.map((c) => c.title)],
        rows: (parsed.rows || []).map((r: any) => ({
          label: r.label || '',
          values: r.values || [],
        })),
        recommendation: parsed.recommendation || '',
      }
    } catch {
      return null
    }
  }
}

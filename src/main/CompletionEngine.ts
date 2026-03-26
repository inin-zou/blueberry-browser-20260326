// src/main/CompletionEngine.ts
import { buildPageContext } from './PageContext'
import { AIEventLog } from './AIEventLog'
import type { Tab } from './Tab'

export interface CompletionRequest {
  tabId: string
  fieldValue: string       // current text in the field
  cursorPosition: number
  fieldLabel?: string      // placeholder or label text
  fieldSelector: string
  pageUrl: string
  pageTitle: string
}

export interface CompletionResponse {
  suggestion: string
  confidence: number
  requestId: string
}

export class CompletionEngine {
  private aiEventLog: AIEventLog
  private pendingRequest: string | null = null  // track latest request to cancel stale ones

  constructor(aiEventLog: AIEventLog) {
    this.aiEventLog = aiEventLog
  }

  async complete(request: CompletionRequest, activeTab: Tab | null): Promise<CompletionResponse | null> {
    const requestId = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    this.pendingRequest = requestId

    // Build context
    let pageContent = ''
    if (activeTab) {
      try {
        const ctx = await buildPageContext(activeTab, { maxContentLength: 2000 })
        pageContent = ctx.content || ''
      } catch {
        // ignore — page may not be ready
      }
    }

    // If a newer request came in while we were building context, abort
    if (this.pendingRequest !== requestId) return null

    // Build prompt for completion
    const prompt = this.buildCompletionPrompt(request, pageContent)

    // Use the Vercel AI SDK with Anthropic
    // In Phase 7, ModelRouter will be used to try local model first
    try {
      const { streamText } = await import('ai')
      const { anthropic } = await import('@ai-sdk/anthropic')

      const result = await streamText({
        model: anthropic('claude-sonnet-4-6-20250514'),
        messages: [
          {
            role: 'system',
            content:
              'You are a text completion assistant. Given context about what the user is typing and the page they are on, predict what they want to type next. Respond ONLY with the completion text — no explanation, no quotes, no prefix. Just the predicted continuation.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 100,
      })

      let suggestion = ''
      for await (const chunk of result.textStream) {
        suggestion += chunk
        // Abort if a newer request came in
        if (this.pendingRequest !== requestId) return null
      }

      suggestion = suggestion.trim()
      if (!suggestion) return null

      const latencyMs = 0  // streaming — approximate

      // Log to AIEventLog
      this.aiEventLog.log({
        id: requestId,
        timestamp: Date.now(),
        tabId: request.tabId,
        type: 'ghost-text',
        trigger: { source: 'typing', userInput: request.fieldValue },
        output: { model: 'cloud', content: suggestion, latencyMs },
        disposition: 'pending',
      })

      return { suggestion, confidence: 0.8, requestId }
    } catch (err) {
      console.error('CompletionEngine error:', err)
      return null
    }
  }

  cancelPending(): void {
    this.pendingRequest = null
  }

  buildCompletionPrompt(request: CompletionRequest, pageContent: string): string {
    const parts: string[] = []
    parts.push(`The user is typing in a text field on: ${request.pageUrl}`)
    if (request.fieldLabel) {
      parts.push(`Field label/placeholder: "${request.fieldLabel}"`)
    }
    parts.push(`Current text so far: "${request.fieldValue}"`)
    parts.push(`Cursor position: ${request.cursorPosition}`)
    if (pageContent) {
      parts.push(`Page content for context:\n${pageContent.substring(0, 1500)}`)
    }
    parts.push('\nPredict the most likely continuation. Respond with ONLY the completion text.')
    return parts.join('\n')
  }
}

// src/main/PageRewriter.ts
import { buildPageContext } from './PageContext'
import { AIEventLog } from './AIEventLog'
import type { Tab } from './Tab'

export type PageType = 'article' | 'documentation' | 'product' | 'dashboard' | 'search' | 'form' | 'unknown'

interface RewriteResult {
  pageType: PageType
  tldr?: string
  keyPoints?: string[]
  simplifiedSections?: { selector: string; simplified: string }[]
}

export class PageRewriter {
  private aiEventLog: AIEventLog

  constructor(aiEventLog: AIEventLog) {
    this.aiEventLog = aiEventLog
  }

  classifyPage(url: string, content: string): PageType {
    const urlLower = url.toLowerCase()
    const contentLower = content.toLowerCase().substring(0, 3000)

    // URL-based heuristics
    if (
      urlLower.includes('/docs') ||
      urlLower.includes('/api') ||
      urlLower.includes('/reference') ||
      urlLower.includes('/guide')
    )
      return 'documentation'
    if (
      urlLower.includes('/product') ||
      urlLower.includes('/item') ||
      urlLower.includes('/dp/')
    )
      return 'product'
    if (
      urlLower.includes('/search') ||
      urlLower.includes('?q=') ||
      urlLower.includes('?query=')
    )
      return 'search'
    if (
      urlLower.includes('/dashboard') ||
      urlLower.includes('/analytics') ||
      urlLower.includes('/admin')
    )
      return 'dashboard'

    // Content-based heuristics
    const wordCount = content.split(/\s+/).length
    if (wordCount > 500) return 'article'

    // Check for form element indicators
    if (
      contentLower.includes('submit') &&
      (contentLower.includes('email') || contentLower.includes('password'))
    )
      return 'form'

    return 'unknown'
  }

  async rewrite(tab: Tab): Promise<RewriteResult | null> {
    const ctx = await buildPageContext(tab, { maxContentLength: 4000 })
    if (!ctx.content) return null

    const pageType = this.classifyPage(ctx.url, ctx.content)
    if (pageType === 'unknown' || pageType === 'form' || pageType === 'search') return null

    try {
      const { streamText } = await import('ai')
      const { anthropic } = await import('@ai-sdk/anthropic')

      let systemPrompt = ''
      if (pageType === 'article') {
        systemPrompt = `Analyze this article and provide a JSON response with:
{
  "tldr": "1-2 sentence TL;DR summary",
  "keyPoints": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"]
}
Be concise and accurate. Max 5 key points.`
      } else if (pageType === 'documentation') {
        systemPrompt = `Analyze this documentation page and provide a JSON response with:
{
  "tldr": "What this page covers in 1 sentence",
  "keyPoints": ["Most important concept 1", "Most important concept 2", "Most important concept 3"]
}
Focus on what a developer needs to know most.`
      } else if (pageType === 'product') {
        systemPrompt = `Analyze this product page and provide a JSON response with:
{
  "tldr": "Product name — price — one sentence verdict",
  "keyPoints": ["Key spec 1", "Key spec 2", "Pro: ...", "Con: ..."]
}
Focus on purchase-decision information.`
      } else if (pageType === 'dashboard') {
        systemPrompt = `Analyze this dashboard and provide a JSON response with:
{
  "tldr": "Overall status in 1 sentence",
  "keyPoints": ["Key metric or anomaly 1", "Key metric or anomaly 2", "Key metric or anomaly 3"]
}
Highlight anything unusual or noteworthy.`
      }

      const startMs = Date.now()
      const result = await streamText({
        model: anthropic('claude-sonnet-4-6-20250514'),
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Page: ${ctx.url}\nTitle: ${ctx.title}\n\nContent:\n${ctx.content}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 500,
      })

      let response = ''
      for await (const chunk of result.textStream) {
        response += chunk
      }

      const parsed = this.parseRewriteResponse(response)
      if (!parsed) return null

      const rewriteResult: RewriteResult = {
        pageType,
        ...parsed,
      }

      // Log to AIEventLog
      this.aiEventLog.log({
        id: `rewrite-${Date.now()}`,
        timestamp: Date.now(),
        tabId: tab.id,
        type: 'page-rewrite',
        trigger: { source: 'manual' },
        output: {
          model: 'cloud',
          content: rewriteResult,
          latencyMs: Date.now() - startMs,
        },
        disposition: 'pending',
      })

      return rewriteResult
    } catch (err) {
      console.error('PageRewriter error:', err)
      return null
    }
  }

  private parseRewriteResponse(
    response: string
  ): { tldr?: string; keyPoints?: string[] } | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      const parsed = JSON.parse(jsonMatch[0])
      return {
        tldr: parsed.tldr || undefined,
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : undefined,
      }
    } catch {
      return null
    }
  }
}

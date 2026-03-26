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
      const { getModel } = await import('./llm-provider')

      const keyPointsSchema = `Each key point must have a "text" (the point) and "anchor" (a short phrase from a heading or paragraph on the page that can be used to find and scroll to the relevant section). Example:
{
  "tldr": "Summary here",
  "keyPoints": [
    {"text": "Key point description", "anchor": "Exact heading or phrase from the page"},
    {"text": "Another point", "anchor": "Another heading from the page"}
  ]
}`

      let systemPrompt = ''
      if (pageType === 'article') {
        systemPrompt = `Analyze this article and provide a JSON response. ${keyPointsSchema}
Be concise and accurate. Max 5 key points. The "anchor" must be an exact phrase or heading that appears in the page content.`
      } else if (pageType === 'documentation') {
        systemPrompt = `Analyze this documentation page and provide a JSON response. ${keyPointsSchema}
Focus on what a developer needs to know most. The "anchor" must match actual section headings from the docs.`
      } else if (pageType === 'product') {
        systemPrompt = `Analyze this product page and provide a JSON response. ${keyPointsSchema}
Focus on purchase-decision information.`
      } else if (pageType === 'dashboard') {
        systemPrompt = `Analyze this dashboard and provide a JSON response. ${keyPointsSchema}
Highlight anything unusual or noteworthy.`
      }

      const startMs = Date.now()
      const result = await streamText({
        model: getModel(),
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
  ): { tldr?: string; keyPoints?: { text: string; anchor: string }[] } | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      const parsed = JSON.parse(jsonMatch[0])

      let keyPoints: { text: string; anchor: string }[] | undefined
      if (Array.isArray(parsed.keyPoints)) {
        keyPoints = parsed.keyPoints.map((kp: any) => {
          if (typeof kp === 'string') {
            // Old format: plain string — use the text as anchor too
            return { text: kp, anchor: kp.substring(0, 40) }
          }
          // New format: { text, anchor }
          return { text: kp.text || kp, anchor: kp.anchor || '' }
        })
      }

      return {
        tldr: parsed.tldr || undefined,
        keyPoints,
      }
    } catch {
      return null
    }
  }
}

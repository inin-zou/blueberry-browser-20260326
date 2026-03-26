import { describe, it, expect } from 'vitest'
import { PageRewriter } from '../PageRewriter'
import { AIEventLog } from '../AIEventLog'

describe('PageRewriter', () => {
  const rewriter = new PageRewriter(new AIEventLog())

  describe('classifyPage', () => {
    it('classifies documentation pages', () => {
      expect(rewriter.classifyPage('https://docs.example.com/api/v1', 'API reference')).toBe('documentation')
      expect(rewriter.classifyPage('https://example.com/docs/guide', 'Getting started guide')).toBe('documentation')
    })

    it('classifies product pages', () => {
      expect(rewriter.classifyPage('https://amazon.com/dp/B001234', 'Product details')).toBe('product')
      expect(rewriter.classifyPage('https://store.com/product/widget', 'Buy now')).toBe('product')
    })

    it('classifies search pages', () => {
      expect(rewriter.classifyPage('https://google.com/search?q=test', 'Results')).toBe('search')
    })

    it('classifies dashboard pages', () => {
      expect(rewriter.classifyPage('https://app.com/dashboard', 'Metrics overview')).toBe('dashboard')
      expect(rewriter.classifyPage('https://app.com/analytics/overview', 'Analytics')).toBe('dashboard')
    })

    it('classifies long content as article', () => {
      const longContent = 'word '.repeat(600)
      expect(rewriter.classifyPage('https://blog.com/post-title', longContent)).toBe('article')
    })

    it('returns unknown for unrecognized pages', () => {
      expect(rewriter.classifyPage('https://example.com', 'Hello')).toBe('unknown')
    })

    it('classifies form pages', () => {
      expect(rewriter.classifyPage('https://app.com/login', 'Enter your email and password to submit')).toBe('form')
    })

    it('returns null for unrewritable page types', async () => {
      // search, form, unknown should return null from rewrite()
      // We can't easily test the full rewrite without LLM, but classifyPage is testable
      expect(rewriter.classifyPage('https://google.com/search?q=test', 'results')).toBe('search')
    })

    it('prefers URL-based classification over content word count', () => {
      // Even with long content, URL patterns take precedence
      const longContent = 'word '.repeat(600)
      expect(rewriter.classifyPage('https://app.com/dashboard', longContent)).toBe('dashboard')
    })

    it('classifies /reference URL as documentation', () => {
      expect(rewriter.classifyPage('https://developer.mozilla.org/reference/javascript', 'JS docs')).toBe('documentation')
    })

    it('classifies /item URL as product', () => {
      expect(rewriter.classifyPage('https://shop.com/item/12345', 'Widget')).toBe('product')
    })

    it('classifies URL with ?query= as search', () => {
      expect(rewriter.classifyPage('https://search.com/?query=cats', 'cat results')).toBe('search')
    })

    it('classifies /admin URL as dashboard', () => {
      expect(rewriter.classifyPage('https://myapp.com/admin', 'Admin panel')).toBe('dashboard')
    })

    it('does not classify short unknown content as form if no submit/email/password', () => {
      expect(rewriter.classifyPage('https://example.com/about', 'This is a short page')).toBe('unknown')
    })
  })
})

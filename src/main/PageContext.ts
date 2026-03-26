// src/main/PageContext.ts
import type { Tab } from './Tab'

export interface PageContext {
  tabId: string
  url: string
  title: string
  content?: string
  screenshot?: string
}

export interface PageContextOptions {
  maxContentLength?: number
  includeScreenshot?: boolean
}

const DEFAULT_MAX_CONTENT = 4000

export async function buildPageContext(
  tab: Tab,
  options: PageContextOptions = {}
): Promise<PageContext> {
  const { maxContentLength = DEFAULT_MAX_CONTENT, includeScreenshot = false } = options

  const ctx: PageContext = {
    tabId: tab.id,
    url: tab.url,
    title: tab.title,
  }

  try {
    const text = await tab.getTabText()
    ctx.content =
      text.length > maxContentLength ? text.substring(0, maxContentLength) + '...' : text
  } catch {
    // Page may not be ready or may block script execution
  }

  if (includeScreenshot) {
    try {
      const image = await tab.screenshot()
      ctx.screenshot = image.toDataURL()
    } catch {
      // Screenshot may fail on some pages
    }
  }

  return ctx
}

export async function getAllTabContexts(
  tabs: Tab[],
  options: PageContextOptions = {}
): Promise<PageContext[]> {
  return Promise.all(tabs.map((tab) => buildPageContext(tab, options)))
}

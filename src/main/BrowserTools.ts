import { tool } from 'ai'
import { z } from 'zod'
import type { Window } from './Window'

/**
 * Browser action tools for the LLM.
 * These let the AI take actions in the active tab.
 */
export function createBrowserTools(getWindow: () => Window | null) {
  return {
    click: tool({
      description: 'Click an element on the current page by CSS selector.',
      parameters: z.object({
        selector: z.string().describe('CSS selector of the element to click'),
      }),
      execute: async ({ selector }: { selector: string }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          return await tab.runJs(`
            (function() {
              var el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return { success: false, error: 'Element not found' };
              el.click();
              return { success: true, clicked: el.tagName + ': ' + (el.textContent || '').trim().substring(0, 50) };
            })()
          `)
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),

    type_text: tool({
      description: 'Type text into an input field by CSS selector.',
      parameters: z.object({
        selector: z.string().describe('CSS selector of the input field'),
        text: z.string().describe('Text to type'),
      }),
      execute: async ({ selector, text }: { selector: string; text: string }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          return await tab.runJs(`
            (function() {
              var el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return { success: false, error: 'Element not found' };
              el.focus();
              el.value = ${JSON.stringify(text)};
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return { success: true, typed: ${JSON.stringify(text)} };
            })()
          `)
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),

    navigate: tool({
      description: 'Navigate the active tab to a URL.',
      parameters: z.object({
        url: z.string().describe('URL to navigate to'),
      }),
      execute: async ({ url }: { url: string }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          let fullUrl = url
          if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
            fullUrl = 'https://' + fullUrl
          }
          await tab.loadURL(fullUrl)
          return { success: true, navigatedTo: fullUrl }
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),

    scroll: tool({
      description: 'Scroll the page up or down.',
      parameters: z.object({
        direction: z.enum(['up', 'down']).describe('Scroll direction'),
        pixels: z.number().default(500).describe('Pixels to scroll'),
      }),
      execute: async ({ direction, pixels }: { direction: string; pixels?: number }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        const px = pixels || 500
        const delta = direction === 'down' ? px : -px
        try {
          await tab.runJs(`window.scrollBy(0, ${delta})`)
          return { success: true, scrolled: direction, pixels: px }
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),

    read_page: tool({
      description: 'Read the text content of the current page.',
      parameters: z.object({
        max_length: z.number().default(3000).describe('Max chars to return'),
      }),
      execute: async ({ max_length }: { max_length?: number }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          const text = await tab.getTabText()
          const limit = max_length || 3000
          return { success: true, url: tab.url, title: tab.title, content: text.substring(0, limit) }
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),

    run_javascript: tool({
      description: 'Execute JavaScript on the current page and return the result.',
      parameters: z.object({
        code: z.string().describe('JavaScript code to execute'),
      }),
      execute: async ({ code }: { code: string }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          const result = await tab.runJs(code)
          return { success: true, result: JSON.stringify(result)?.substring(0, 2000) }
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),

    get_page_elements: tool({
      description: 'List interactive elements (buttons, links, inputs) on the page.',
      parameters: z.object({
        element_type: z.enum(['buttons', 'links', 'inputs', 'all']).default('all').describe('Type of elements'),
      }),
      execute: async ({ element_type }: { element_type?: string }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          return await tab.runJs(`
            (function() {
              var t = ${JSON.stringify(element_type || 'all')};
              var r = [];
              if (t === 'all' || t === 'buttons') {
                document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(function(el, i) {
                  if (i < 15) r.push({ type: 'button', text: (el.textContent || el.value || '').trim().substring(0, 40), selector: el.id ? '#' + el.id : 'button:nth-of-type(' + (i+1) + ')' });
                });
              }
              if (t === 'all' || t === 'links') {
                document.querySelectorAll('a[href]').forEach(function(el, i) {
                  if (i < 15) r.push({ type: 'link', text: (el.textContent || '').trim().substring(0, 40), href: el.href, selector: el.id ? '#' + el.id : 'a:nth-of-type(' + (i+1) + ')' });
                });
              }
              if (t === 'all' || t === 'inputs') {
                document.querySelectorAll('input, textarea, select').forEach(function(el, i) {
                  if (i < 15) r.push({ type: 'input', name: el.name, placeholder: el.placeholder, selector: el.id ? '#' + el.id : el.name ? '[name="' + el.name + '"]' : 'input:nth-of-type(' + (i+1) + ')' });
                });
              }
              return { elements: r, count: r.length };
            })()
          `)
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),
  }
}

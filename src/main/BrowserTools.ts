import { tool } from 'ai'
import { z } from 'zod'
import type { Window } from './Window'

/**
 * Browser action tools for the LLM.
 * These let the AI take actions in the active tab:
 * click elements, type text, navigate, scroll, read page content, and run JavaScript.
 */
export function createBrowserTools(getWindow: () => Window | null) {
  return {
    click: tool({
      description: 'Click an element on the current page. Use a CSS selector or describe the element to click.',
      parameters: z.object({
        selector: z.string().describe('CSS selector of the element to click (e.g., "button.submit", "#login", "a[href=\'/signup\']")'),
      }),
      execute: async ({ selector }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          const result = await tab.runJs(`
            (function() {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return { success: false, error: 'Element not found: ${selector}' };
              el.click();
              return { success: true, clicked: el.tagName + (el.textContent ? ': ' + el.textContent.trim().substring(0, 50) : '') };
            })()
          `)
          return result
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),

    type_text: tool({
      description: 'Type text into an input field on the current page. Finds the element by CSS selector and sets its value.',
      parameters: z.object({
        selector: z.string().describe('CSS selector of the input field'),
        text: z.string().describe('Text to type into the field'),
      }),
      execute: async ({ selector, text }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          const result = await tab.runJs(`
            (function() {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return { success: false, error: 'Element not found' };
              el.focus();
              el.value = ${JSON.stringify(text)};
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return { success: true, typed: ${JSON.stringify(text)} };
            })()
          `)
          return result
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),

    navigate: tool({
      description: 'Navigate the active tab to a URL.',
      parameters: z.object({
        url: z.string().describe('The URL to navigate to'),
      }),
      execute: async ({ url }) => {
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
      description: 'Scroll the page up or down by a specified amount.',
      parameters: z.object({
        direction: z.enum(['up', 'down']).describe('Scroll direction'),
        amount: z.number().optional().describe('Pixels to scroll (default 500)'),
      }),
      execute: async ({ direction, amount }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        const px = amount || 500
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
      description: 'Read the text content of the current page. Use this to understand what is on the page before taking actions.',
      parameters: z.object({
        maxLength: z.number().optional().describe('Maximum characters to return (default 3000)'),
      }),
      execute: async ({ maxLength }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          const text = await tab.getTabText()
          const limit = maxLength || 3000
          return {
            success: true,
            url: tab.url,
            title: tab.title,
            content: text.substring(0, limit),
            truncated: text.length > limit,
          }
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),

    run_javascript: tool({
      description: 'Execute custom JavaScript on the current page and return the result. Use for complex actions that other tools cannot handle.',
      parameters: z.object({
        code: z.string().describe('JavaScript code to execute. Must return a value (use an IIFE if needed).'),
      }),
      execute: async ({ code }) => {
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
      description: 'List interactive elements on the current page (buttons, links, inputs). Useful for understanding what actions are available.',
      parameters: z.object({
        type: z.enum(['buttons', 'links', 'inputs', 'all']).optional().describe('Type of elements to list (default: all)'),
      }),
      execute: async ({ type }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          const result = await tab.runJs(`
            (function() {
              const elemType = ${JSON.stringify(type || 'all')};
              const results = [];

              if (elemType === 'all' || elemType === 'buttons') {
                document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach((el, i) => {
                  if (i < 20) results.push({ type: 'button', text: (el.textContent || el.value || '').trim().substring(0, 50), selector: el.id ? '#' + el.id : 'button:nth-of-type(' + (i+1) + ')' });
                });
              }
              if (elemType === 'all' || elemType === 'links') {
                document.querySelectorAll('a[href]').forEach((el, i) => {
                  if (i < 20) results.push({ type: 'link', text: (el.textContent || '').trim().substring(0, 50), href: el.href, selector: el.id ? '#' + el.id : 'a:nth-of-type(' + (i+1) + ')' });
                });
              }
              if (elemType === 'all' || elemType === 'inputs') {
                document.querySelectorAll('input, textarea, select').forEach((el, i) => {
                  if (i < 20) results.push({ type: 'input', inputType: el.type || 'text', name: el.name, placeholder: el.placeholder, selector: el.id ? '#' + el.id : el.name ? '[name="' + el.name + '"]' : 'input:nth-of-type(' + (i+1) + ')' });
                });
              }
              return { elements: results, count: results.length };
            })()
          `)
          return { success: true, ...result }
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),
  }
}

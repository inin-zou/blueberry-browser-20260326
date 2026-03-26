import { tool, jsonSchema } from 'ai'
import type { Window } from './Window'

/**
 * Browser action tools using jsonSchema (not zod) for OpenAI compatibility.
 */
export function createBrowserTools(getWindow: () => Window | null) {
  return {
    click: tool({
      description: 'Click an element on the current page by CSS selector.',
      inputSchema: jsonSchema<{ selector: string }>({
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the element to click' },
        },
        required: ['selector'],
      }),
      execute: async ({ selector }) => {
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
      description: 'Type text into an input field. Provide a CSS selector, or a placeholder/label text to search for the field.',
      inputSchema: jsonSchema<{ selector: string; text: string }>({
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector OR placeholder text of the input field' },
          text: { type: 'string', description: 'Text to type' },
        },
        required: ['selector', 'text'],
      }),
      execute: async ({ selector, text }) => {
        const tab = getWindow()?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }
        try {
          return await tab.runJs(`
            (function() {
              var sel = ${JSON.stringify(selector)};
              var el = document.querySelector(sel);

              // Fallback: search by placeholder text
              if (!el) {
                var inputs = document.querySelectorAll('input, textarea');
                for (var i = 0; i < inputs.length; i++) {
                  if (inputs[i].placeholder && inputs[i].placeholder.toLowerCase().indexOf(sel.toLowerCase()) !== -1) {
                    el = inputs[i]; break;
                  }
                }
              }

              // Fallback: search by aria-label
              if (!el) {
                var inputs2 = document.querySelectorAll('input, textarea');
                for (var i = 0; i < inputs2.length; i++) {
                  var label = inputs2[i].getAttribute('aria-label') || '';
                  if (label.toLowerCase().indexOf(sel.toLowerCase()) !== -1) {
                    el = inputs2[i]; break;
                  }
                }
              }

              // Fallback: find the first visible text input
              if (!el) {
                var inputs3 = document.querySelectorAll('input[type="text"], input[type="search"], input:not([type]), textarea');
                for (var i = 0; i < inputs3.length; i++) {
                  var rect = inputs3[i].getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    el = inputs3[i]; break;
                  }
                }
              }

              if (!el) return { success: false, error: 'No input field found on page' };

              el.focus();
              el.value = ${JSON.stringify(text)};
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));

              // Try pressing Enter to submit search
              el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));

              return { success: true, typed: ${JSON.stringify(text)}, foundVia: el.placeholder || el.name || el.id || 'fallback' };
            })()
          `)
        } catch (err: any) {
          return { success: false, error: err.message }
        }
      },
    }),

    navigate: tool({
      description: 'Navigate the active tab to a URL.',
      inputSchema: jsonSchema<{ url: string }>({
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to' },
        },
        required: ['url'],
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
      description: 'Scroll the page up or down.',
      inputSchema: jsonSchema<{ direction: string; pixels: number }>({
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
          pixels: { type: 'number', description: 'Pixels to scroll, default 500' },
        },
        required: ['direction'],
      }),
      execute: async ({ direction, pixels }) => {
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
      inputSchema: jsonSchema<{ max_length: number }>({
        type: 'object',
        properties: {
          max_length: { type: 'number', description: 'Max chars to return, default 3000' },
        },
        required: [],
      }),
      execute: async ({ max_length }) => {
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
      inputSchema: jsonSchema<{ code: string }>({
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to execute' },
        },
        required: ['code'],
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

    run_in_sandbox: tool({
      description: 'Run JavaScript code in an isolated sandbox against a snapshot of the current page DOM. Use this to extract data, scrape content, analyze page structure, or transform page data. The code runs safely against a copy — it cannot affect the live page. Return structured data from your script.',
      inputSchema: jsonSchema<{ code: string; description: string }>({
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to execute against the page DOM. Must return a value (use return in the function body). Can use document.querySelectorAll, etc.' },
          description: { type: 'string', description: 'Brief description of what this script does' },
        },
        required: ['code', 'description'],
      }),
      execute: async ({ code, description }) => {
        const win = getWindow()
        const tab = win?.activeTab
        if (!tab) return { success: false, error: 'No active tab' }

        try {
          // Get DOM snapshot
          const domSnapshot = await tab.getDomSnapshot()

          // Import and use SandboxManager
          const { SandboxManager } = await import('./SandboxManager')
          const { AIEventLog } = await import('./AIEventLog')
          const sandbox = new SandboxManager(win.aiEventLog)

          const result = await sandbox.execute({
            id: `sandbox-${Date.now()}`,
            domSnapshot,
            script: code,
            sourceTabId: tab.id,
            timeout: 10000,
          })

          if (result.status === 'success') {
            return {
              success: true,
              description,
              output: result.output,
              executionTimeMs: result.executionTimeMs,
            }
          } else {
            return {
              success: false,
              error: result.error || result.status,
              description,
            }
          }
        } catch (err: any) {
          return { success: false, error: err.message, description }
        }
      },
    }),

    get_page_elements: tool({
      description: 'List interactive elements (buttons, links, inputs) on the page.',
      inputSchema: jsonSchema<{ element_type: string }>({
        type: 'object',
        properties: {
          element_type: { type: 'string', enum: ['buttons', 'links', 'inputs', 'all'], description: 'Type of elements, default all' },
        },
        required: [],
      }),
      execute: async ({ element_type }) => {
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

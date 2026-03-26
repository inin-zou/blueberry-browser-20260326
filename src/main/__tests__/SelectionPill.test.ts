// src/main/__tests__/SelectionPill.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SELECTION_PILL_SCRIPT } from '../scripts/selection-pill-script'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockSidebar(isVisible: boolean) {
  return {
    getIsVisible: vi.fn(() => isVisible),
    toggle: vi.fn(),
    view: {
      webContents: {
        send: vi.fn(),
      },
    },
  }
}

function createMockWindow(sidebarVisible: boolean) {
  const sidebar = createMockSidebar(sidebarVisible)
  return {
    sidebar,
    updateAllBounds: vi.fn(),
  }
}

// Minimal IPC mock that captures `ipcMain.on` handlers
function createIpcMock() {
  const handlers: Record<string, Function> = {}
  return {
    ipc: {
      on: vi.fn((channel: string, handler: Function) => {
        handlers[channel] = handler
      }),
    },
    handlers,
  }
}

// Dynamically wire up the selection event handler logic (mirrors EventManager.handleSelectionEvents)
function invokeSelectionHandler(
  mainWindow: ReturnType<typeof createMockWindow>,
  data: { action: string; text: string; url: string; context: string }
) {
  const sidebar = mainWindow.sidebar
  if (data.action === 'ask' || data.action === 'explain') {
    if (!sidebar.getIsVisible()) {
      sidebar.toggle()
      mainWindow.updateAllBounds()
    }
    sidebar.view.webContents.send('sidebar:open-with-context', {
      text: data.text,
      url: data.url,
      context: data.context,
      mode: data.action,
    })
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SelectionPill — IPC handler logic', () => {
  describe('action: ask', () => {
    it('opens the sidebar when it is closed and sends context', () => {
      const win = createMockWindow(false /* sidebar hidden */)
      invokeSelectionHandler(win, {
        action: 'ask',
        text: 'hello world',
        url: 'https://example.com',
        context: 'Some surrounding text',
      })

      expect(win.sidebar.toggle).toHaveBeenCalledOnce()
      expect(win.updateAllBounds).toHaveBeenCalledOnce()
      expect(win.sidebar.view.webContents.send).toHaveBeenCalledWith(
        'sidebar:open-with-context',
        {
          text: 'hello world',
          url: 'https://example.com',
          context: 'Some surrounding text',
          mode: 'ask',
        }
      )
    })

    it('does not toggle sidebar when it is already visible', () => {
      const win = createMockWindow(true /* sidebar visible */)
      invokeSelectionHandler(win, {
        action: 'ask',
        text: 'selected text',
        url: 'https://example.com',
        context: '',
      })

      expect(win.sidebar.toggle).not.toHaveBeenCalled()
      expect(win.updateAllBounds).not.toHaveBeenCalled()
      expect(win.sidebar.view.webContents.send).toHaveBeenCalledWith(
        'sidebar:open-with-context',
        expect.objectContaining({ mode: 'ask' })
      )
    })
  })

  describe('action: explain', () => {
    it('opens the sidebar when it is closed and sends context with mode explain', () => {
      const win = createMockWindow(false)
      invokeSelectionHandler(win, {
        action: 'explain',
        text: 'a term',
        url: 'https://example.com/page',
        context: 'Paragraph context here',
      })

      expect(win.sidebar.toggle).toHaveBeenCalledOnce()
      expect(win.updateAllBounds).toHaveBeenCalledOnce()
      expect(win.sidebar.view.webContents.send).toHaveBeenCalledWith(
        'sidebar:open-with-context',
        {
          text: 'a term',
          url: 'https://example.com/page',
          context: 'Paragraph context here',
          mode: 'explain',
        }
      )
    })

    it('does not toggle sidebar when it is already visible', () => {
      const win = createMockWindow(true)
      invokeSelectionHandler(win, {
        action: 'explain',
        text: 'a term',
        url: 'https://example.com',
        context: '',
      })

      expect(win.sidebar.toggle).not.toHaveBeenCalled()
      expect(win.sidebar.view.webContents.send).toHaveBeenCalledWith(
        'sidebar:open-with-context',
        expect.objectContaining({ mode: 'explain' })
      )
    })
  })

  describe('unknown action', () => {
    it('does nothing for an unrecognised action', () => {
      const win = createMockWindow(false)
      invokeSelectionHandler(win, {
        action: 'unknown',
        text: 'text',
        url: 'https://example.com',
        context: '',
      })

      expect(win.sidebar.toggle).not.toHaveBeenCalled()
      expect(win.sidebar.view.webContents.send).not.toHaveBeenCalled()
    })
  })
})

describe('SelectionPill — script string sanity', () => {
  it('exports a non-empty string', () => {
    expect(typeof SELECTION_PILL_SCRIPT).toBe('string')
    expect(SELECTION_PILL_SCRIPT.length).toBeGreaterThan(0)
  })

  it('is a self-executing function (IIFE)', () => {
    expect(SELECTION_PILL_SCRIPT.trimStart()).toMatch(/^\(function\s*\(/)
    expect(SELECTION_PILL_SCRIPT.trimEnd()).toMatch(/\)\s*\(\s*\)\s*;?$/)
  })

  it('guards against double-injection', () => {
    expect(SELECTION_PILL_SCRIPT).toContain('__blueberrySelectionPillActive')
  })

  it('sends selection:action via window.blueberry', () => {
    expect(SELECTION_PILL_SCRIPT).toContain("selection:action")
    expect(SELECTION_PILL_SCRIPT).toContain('window.blueberry')
  })

  it('contains both Explain and Ask AI button labels', () => {
    expect(SELECTION_PILL_SCRIPT).toContain('Explain')
    expect(SELECTION_PILL_SCRIPT).toContain('Ask AI')
  })

  it('is parseable as valid JavaScript', () => {
    expect(() => new Function(SELECTION_PILL_SCRIPT)).not.toThrow()
  })
})

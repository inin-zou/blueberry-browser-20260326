// src/main/SandboxManager.ts
import { WebContentsView } from 'electron'
import { AIEventLog } from './AIEventLog'
import { net } from 'electron'

export interface SandboxRequest {
  id: string
  domSnapshot: string
  script: string
  timeout?: number          // default 10000ms
  sourceTabId: string
}

export interface SandboxResult {
  id: string
  status: 'success' | 'error' | 'timeout'
  output: any
  consoleOutput: string[]
  error?: string
  executionTimeMs: number
  script: string
  executedVia: 'modal' | 'local'
}

// Modal cloud sandbox endpoints
const MODAL_SCRIPT_URL = process.env.MODAL_SANDBOX_SCRIPT_URL
  || 'https://yongkang-zou1999--blueberry-sandbox-api-run-script.modal.run'
const MODAL_PLAYWRIGHT_URL = process.env.MODAL_SANDBOX_PLAYWRIGHT_URL
  || 'https://yongkang-zou1999--blueberry-sandbox-api-run-playwright.modal.run'

export class SandboxManager {
  private aiEventLog: AIEventLog
  private executions: SandboxResult[] = []
  private useModal: boolean

  constructor(aiEventLog: AIEventLog) {
    this.aiEventLog = aiEventLog
    // Use Modal if token is configured, otherwise local fallback
    this.useModal = !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET)
    console.log(`[Sandbox] Mode: ${this.useModal ? 'Modal (cloud)' : 'Local (WebContentsView)'}`)
  }

  async execute(request: SandboxRequest): Promise<SandboxResult> {
    if (this.useModal) {
      try {
        return await this.executeViaModal(request)
      } catch (err) {
        console.error('[Sandbox] Modal failed, falling back to local:', err)
        return await this.executeLocal(request)
      }
    }
    return await this.executeLocal(request)
  }

  // Execute via Modal cloud sandbox (primary)
  private async executeViaModal(request: SandboxRequest): Promise<SandboxResult> {
    const startTime = Date.now()

    try {
      const response = await fetch(MODAL_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html_snapshot: request.domSnapshot,
          script: request.script,
        }),
      })

      if (!response.ok) {
        throw new Error(`Modal API returned ${response.status}: ${await response.text()}`)
      }

      const data = await response.json() as any
      const executionTimeMs = Date.now() - startTime

      const result: SandboxResult = {
        id: request.id,
        status: data.success ? 'success' : 'error',
        output: data.output ?? null,
        consoleOutput: [],
        error: data.error,
        executionTimeMs,
        script: request.script,
        executedVia: 'modal',
      }

      this.logExecution(result, request)
      return result
    } catch (err) {
      throw err // Let caller handle fallback
    }
  }

  // Execute via Playwright on Modal (for multi-step browser automation)
  async executePlaywright(steps: any[]): Promise<any> {
    try {
      const response = await fetch(MODAL_PLAYWRIGHT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      })

      if (!response.ok) {
        throw new Error(`Modal Playwright API returned ${response.status}`)
      }

      return await response.json()
    } catch (err) {
      console.error('[Sandbox] Playwright execution failed:', err)
      return { success: false, error: String(err), results: [] }
    }
  }

  // Execute locally via WebContentsView (fallback)
  private async executeLocal(request: SandboxRequest): Promise<SandboxResult> {
    const startTime = Date.now()
    const timeout = request.timeout || 10000

    try {
      const sandboxView = new WebContentsView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          javascript: true,
        },
      })

      await sandboxView.webContents.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(request.domSnapshot)}`
      )

      const result = await Promise.race([
        this.executeInView(sandboxView, request.script),
        this.timeoutPromise(timeout),
      ])

      try { sandboxView.webContents.close() } catch {}

      const executionTimeMs = Date.now() - startTime

      if (result === '__TIMEOUT__') {
        const timeoutResult: SandboxResult = {
          id: request.id,
          status: 'timeout',
          output: null,
          consoleOutput: [],
          error: `Execution timed out after ${timeout}ms`,
          executionTimeMs,
          script: request.script,
          executedVia: 'local',
        }
        this.logExecution(timeoutResult, request)
        return timeoutResult
      }

      const successResult: SandboxResult = {
        id: request.id,
        status: 'success',
        output: result,
        consoleOutput: [],
        executionTimeMs,
        script: request.script,
        executedVia: 'local',
      }
      this.logExecution(successResult, request)
      return successResult
    } catch (err) {
      const errorResult: SandboxResult = {
        id: request.id,
        status: 'error',
        output: null,
        consoleOutput: [],
        error: err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - startTime,
        script: request.script,
        executedVia: 'local',
      }
      this.logExecution(errorResult, request)
      return errorResult
    }
  }

  getHistory(): SandboxResult[] {
    return [...this.executions]
  }

  private async executeInView(view: WebContentsView, script: string): Promise<any> {
    const wrappedScript = `
      (async function() {
        try {
          const __result = await (async function() { ${script} })();
          return JSON.parse(JSON.stringify(__result !== undefined ? __result : null));
        } catch (e) {
          return { __error: e.message || String(e) };
        }
      })()
    `
    const result = await view.webContents.executeJavaScript(wrappedScript)
    if (result && result.__error) {
      throw new Error(result.__error)
    }
    return result
  }

  private timeoutPromise(ms: number): Promise<string> {
    return new Promise((resolve) => setTimeout(() => resolve('__TIMEOUT__'), ms))
  }

  private logExecution(result: SandboxResult, request: SandboxRequest): void {
    this.executions.push(result)
    if (this.executions.length > 50) this.executions.shift()

    this.aiEventLog.log({
      id: result.id,
      timestamp: Date.now(),
      tabId: request.sourceTabId,
      type: 'sandbox',
      trigger: { source: 'user-chat' },
      output: {
        model: result.executedVia === 'modal' ? 'cloud' : 'local',
        content: { status: result.status, output: result.output },
        latencyMs: result.executionTimeMs,
      },
      disposition: result.status === 'success' ? 'pending' : 'dismissed',
    })
  }
}

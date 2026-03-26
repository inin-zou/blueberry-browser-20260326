// src/main/SandboxManager.ts
import { WebContentsView } from 'electron'
import { AIEventLog } from './AIEventLog'

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
}

export class SandboxManager {
  private aiEventLog: AIEventLog
  private executions: SandboxResult[] = []

  constructor(aiEventLog: AIEventLog) {
    this.aiEventLog = aiEventLog
  }

  async execute(request: SandboxRequest): Promise<SandboxResult> {
    const startTime = Date.now()
    const timeout = request.timeout || 10000

    try {
      // Create an isolated WebContentsView
      const sandboxView = new WebContentsView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          javascript: true,
          // No preload — fully isolated
        },
      })

      // Load the DOM snapshot as HTML
      await sandboxView.webContents.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(request.domSnapshot)}`
      )

      // Execute the script with timeout
      const result = await Promise.race([
        this.executeInView(sandboxView, request.script),
        this.timeoutPromise(timeout),
      ])

      // Destroy the sandbox view
      sandboxView.webContents.close()

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
      }
      this.logExecution(errorResult, request)
      return errorResult
    }
  }

  getHistory(): SandboxResult[] {
    return [...this.executions]
  }

  private async executeInView(view: WebContentsView, script: string): Promise<any> {
    // Wrap script to capture return value
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
    // Cap history at 50
    if (this.executions.length > 50) this.executions.shift()

    this.aiEventLog.log({
      id: result.id,
      timestamp: Date.now(),
      tabId: request.sourceTabId,
      type: 'sandbox',
      trigger: { source: 'user-chat' },
      output: {
        model: 'local',
        content: { status: result.status, output: result.output },
        latencyMs: result.executionTimeMs,
      },
      disposition: result.status === 'success' ? 'pending' : 'dismissed',
    })
  }
}

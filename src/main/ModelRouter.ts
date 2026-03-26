// src/main/ModelRouter.ts
export type InferenceTask = 'completion' | 'explain' | 'synthesize' | 'rewrite' | 'classify'

export interface InferenceRequest {
  task: InferenceTask
  input: { text?: string; image?: string; context?: any }
  latencyBudget: 'fast' | 'normal'
  confidenceThreshold?: number
}

export interface InferenceResponse {
  result: any
  model: 'local' | 'cloud'
  confidence: number
  latencyMs: number
}

type InferFn = (request: InferenceRequest) => Promise<{ result: any; confidence: number }>

interface ModelRouterOptions {
  localInfer: InferFn | null
  cloudInfer: InferFn
}

export class ModelRouter {
  private localInfer: InferFn | null
  private cloudInfer: InferFn

  constructor(options: ModelRouterOptions) {
    this.localInfer = options.localInfer
    this.cloudInfer = options.cloudInfer
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const start = Date.now()
    const threshold = request.confidenceThreshold ?? 0.5

    // Try local first for fast tasks
    if (request.latencyBudget === 'fast' && this.localInfer) {
      try {
        const local = await this.localInfer(request)
        if (local.confidence >= threshold) {
          return {
            result: local.result,
            model: 'local',
            confidence: local.confidence,
            latencyMs: Date.now() - start,
          }
        }
      } catch {
        // Fall through to cloud
      }
    }

    // Cloud path
    const cloud = await this.cloudInfer(request)
    return {
      result: cloud.result,
      model: 'cloud',
      confidence: cloud.confidence,
      latencyMs: Date.now() - start,
    }
  }

  setLocalInfer(fn: InferFn | null): void {
    this.localInfer = fn
  }
}

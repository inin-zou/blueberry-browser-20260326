// src/main/LocalModelManager.ts
import { WebContentsView } from 'electron'

export class LocalModelManager {
  private modelView: WebContentsView | null = null
  private ready = false
  private pendingRequests: Map<
    string,
    { resolve: (result: string) => void; reject: (err: Error) => void }
  > = new Map()

  async initialize(): Promise<void> {
    // Create a hidden WebContentsView for running the model
    this.modelView = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: false, // Need access to run transformers.js
        sandbox: false,
        webSecurity: false, // Allow loading local model files
      },
    })

    // Load a minimal HTML page that will run the model
    const htmlContent = this.buildModelPage()
    await this.modelView.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
    )

    // Listen for messages from the model view via console-message
    this.modelView.webContents.on('console-message', (_event, _level, message) => {
      try {
        const parsed = JSON.parse(message)
        if (parsed.type === 'model-ready') {
          this.ready = true
          console.log('[LocalModel] Qwen2.5-0.5B loaded and ready')
        } else if (parsed.type === 'inference-result') {
          const pending = this.pendingRequests.get(parsed.requestId)
          if (pending) {
            pending.resolve(parsed.result)
            this.pendingRequests.delete(parsed.requestId)
          }
        } else if (parsed.type === 'inference-error') {
          const pending = this.pendingRequests.get(parsed.requestId)
          if (pending) {
            pending.reject(new Error(parsed.error))
            this.pendingRequests.delete(parsed.requestId)
          }
        } else if (parsed.type === 'model-error') {
          console.error('[LocalModel] Failed to load:', parsed.error)
        } else if (parsed.type === 'model-loading') {
          console.log('[LocalModel] Qwen2.5-0.5B downloading/loading...')
        }
      } catch {
        // Regular console message, not JSON — ignore
      }
    })
  }

  async infer(prompt: string, maxTokens = 80): Promise<string> {
    if (!this.ready || !this.modelView) {
      throw new Error('Local model not ready')
    }

    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject })

      // 10-second timeout per request
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error('Local model inference timeout'))
        }
      }, 10000)

      // Send inference request to the model view
      this.modelView!.webContents
        .executeJavaScript(
          `window.__blueberryInfer(${JSON.stringify(requestId)}, ${JSON.stringify(prompt)}, ${maxTokens})`
        )
        .catch((err: Error) => {
          clearTimeout(timer)
          this.pendingRequests.delete(requestId)
          reject(err)
        })
    })
  }

  get isReady(): boolean {
    return this.ready
  }

  destroy(): void {
    if (this.modelView) {
      this.modelView.webContents.close()
      this.modelView = null
    }
    this.ready = false
    this.pendingRequests.clear()
  }

  private buildModelPage(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';

    // Disable browser cache so the model always loads fresh from HF Hub (first run downloads it)
    env.allowLocalModels = true;
    env.useBrowserCache = false;

    let generator = null;

    async function loadModel() {
      try {
        console.log(JSON.stringify({ type: 'model-loading' }));

        // Load quantized Qwen2.5-0.5B-Instruct from HuggingFace Hub (~460 MB, cached after first run)
        // Try WebGPU first, fall back to WASM if unavailable
        let device = 'wasm';
        try {
          if (navigator.gpu) {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) device = 'webgpu';
          }
        } catch (e) { /* WebGPU not available, use WASM */ }

        console.log(JSON.stringify({ type: 'model-loading', device }));

        generator = await pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct', {
          dtype: device === 'webgpu' ? 'q4f16' : 'q4',
          device: device,
        });

        console.log(JSON.stringify({ type: 'model-ready' }));
      } catch (err) {
        console.log(JSON.stringify({ type: 'model-error', error: err.message || String(err) }));
      }
    }

    window.__blueberryInfer = async function(requestId, prompt, maxTokens) {
      if (!generator) {
        console.log(JSON.stringify({ type: 'inference-error', requestId, error: 'Model not loaded' }));
        return;
      }
      try {
        const messages = [
          {
            role: 'system',
            content: 'You are a concise assistant. Explain briefly in 1-2 sentences. No emojis. Plain text.',
          },
          { role: 'user', content: prompt },
        ];
        const result = await generator(messages, {
          max_new_tokens: maxTokens,
          temperature: 0.3,
          do_sample: true,
        });
        const text = result[0].generated_text.at(-1).content || '';
        console.log(JSON.stringify({ type: 'inference-result', requestId, result: text }));
      } catch (err) {
        console.log(JSON.stringify({ type: 'inference-error', requestId, error: err.message || String(err) }));
      }
    };

    loadModel();
  </script>
</head>
<body>Local Model Runtime</body>
</html>`
  }
}

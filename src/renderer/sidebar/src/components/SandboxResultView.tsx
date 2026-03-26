import React, { useState } from 'react'

interface SandboxResultViewProps {
  result: {
    id: string
    status: 'success' | 'error' | 'timeout'
    output: any
    error?: string
    executionTimeMs: number
    script: string
  }
  onApply: () => void
  onBack: () => void
}

export function SandboxResultView({ result, onApply, onBack }: SandboxResultViewProps) {
  const [showCode, setShowCode] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-[#C2C1FF]">Sandbox Result</h2>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
            result.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
            result.status === 'error' ? 'bg-red-500/20 text-red-400' :
            'bg-yellow-500/20 text-yellow-400'
          }`}>
            {result.status} — {result.executionTimeMs}ms
          </span>
        </div>
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/5 transition-all"
        >
          ← Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Code toggle */}
        <button
          onClick={() => setShowCode(!showCode)}
          className="text-xs text-slate-400 hover:text-[#C2C1FF] transition-colors"
        >
          {showCode ? '▼ Hide code' : '▶ Show code'}
        </button>

        {showCode && (
          <pre className="bg-[#0e0e13] border border-white/5 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
            {result.script}
          </pre>
        )}

        {/* Output */}
        {result.status === 'success' && result.output !== null && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Output</p>
            <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
              {typeof result.output === 'string'
                ? result.output
                : JSON.stringify(result.output, null, 2)}
            </pre>
          </div>
        )}

        {/* Error */}
        {result.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-400">{result.error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {result.status === 'success' && (
        <div className="p-4 border-t border-white/10 flex gap-2">
          <button
            onClick={onApply}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-[#5E5CE6] to-[#C2C1FF] text-white text-sm font-bold rounded-lg hover:scale-[1.02] active:scale-95 transition-transform"
          >
            Apply to Page
          </button>
          <button
            onClick={() => {
              const text = typeof result.output === 'string'
                ? result.output
                : JSON.stringify(result.output, null, 2)
              navigator.clipboard.writeText(text).catch(() => {})
            }}
            className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 text-sm rounded-lg hover:bg-white/10 transition-all"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  )
}

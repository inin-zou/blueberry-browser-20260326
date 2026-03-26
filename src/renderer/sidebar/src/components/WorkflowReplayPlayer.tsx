import React, { useState } from 'react'

interface WorkflowStep {
  step: number
  timestamp: number
  action: string
  data: {
    url?: string
    selector?: string
    value?: string
    position?: { x: number; y: number }
  }
}

interface WorkflowReplayPlayerProps {
  recording: {
    id: string
    name?: string
    duration: number
    actions: WorkflowStep[]
    tabId: string
  }
  onSave: () => void
  onDiscard: () => void
  onBack: () => void
}

export function WorkflowReplayPlayer({ recording, onSave, onDiscard, onBack }: WorkflowReplayPlayerProps) {
  const [replaying, setReplaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [replayResults, setReplayResults] = useState<{ step: number; success: boolean; error?: string }[] | null>(null)
  const [saved, setSaved] = useState(false)

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return `${m}:${String(s % 60).padStart(2, '0')}`
  }

  const getStepLabel = (step: WorkflowStep) => {
    switch (step.action) {
      case 'navigate': return `Navigate to ${step.data.url ? (() => { try { return new URL(step.data.url!).hostname } catch { return step.data.url } })() : 'page'}`
      case 'click': return `Click ${step.data.selector || 'element'}`
      case 'type': return `Type "${(step.data.value || '').substring(0, 30)}${(step.data.value || '').length > 30 ? '...' : ''}"`
      case 'scroll': return 'Scroll page'
      default: return step.action
    }
  }

  const getStepStatus = (stepNum: number) => {
    if (replayResults) {
      const result = replayResults.find(r => r.step === stepNum)
      if (result) return result.success ? 'success' : 'failed'
    }
    if (replaying && stepNum === currentStep) return 'running'
    if (replaying && stepNum < currentStep) return 'done'
    return 'pending'
  }

  const handleReplay = async () => {
    setReplaying(true)
    setCurrentStep(0)
    setReplayResults(null)

    try {
      // Simulate step progress
      for (let i = 0; i < recording.actions.length; i++) {
        setCurrentStep(recording.actions[i].step)
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      const result = await window.sidebarAPI.replayWorkflow(recording.actions)
      setReplayResults(result.results || [])
    } catch (err) {
      console.error('Replay failed:', err)
    } finally {
      setReplaying(false)
      setCurrentStep(-1)
    }
  }

  const handleSave = async () => {
    await onSave()
    setSaved(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#C2C1FF]">
            {saved ? 'Workflow Saved' : 'Workflow Recorded'}
          </h2>
          <span className="text-[10px] font-mono text-slate-500">
            {recording.actions.length} steps
            {replaying && ` — replaying step ${currentStep}/${recording.actions.length}`}
          </span>
        </div>
        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/5 transition-all">
          ← Chat
        </button>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-3">Workflow Steps</p>
        <div className="space-y-1">
          {recording.actions.map((step, i) => {
            const status = getStepStatus(step.step)
            return (
              <div key={i} className="flex items-start gap-3 py-2">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all ${
                    status === 'success' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' :
                    status === 'failed' ? 'bg-red-500/20 border border-red-500/30 text-red-400' :
                    status === 'running' ? 'bg-[#5E5CE6]/40 border border-[#5E5CE6] text-white animate-pulse' :
                    status === 'done' ? 'bg-[#5E5CE6]/20 border border-[#5E5CE6]/30 text-[#C2C1FF]' :
                    'bg-white/5 border border-white/10 text-slate-500'
                  }`}>
                    {status === 'success' ? '\u2713' : status === 'failed' ? '\u2717' : step.step}
                  </div>
                  {i < recording.actions.length - 1 && (
                    <div className={`w-px h-4 mt-1 ${
                      status === 'success' || status === 'done' ? 'bg-[#5E5CE6]/30' : 'bg-white/10'
                    }`}></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${
                    status === 'running' ? 'text-white' :
                    status === 'failed' ? 'text-red-400' :
                    'text-slate-300'
                  }`}>{getStepLabel(step)}</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {step.action}
                    {status === 'failed' && replayResults && (
                      <span className="text-red-400 ml-1">
                        — {replayResults.find(r => r.step === step.step)?.error}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Replay summary */}
        {replayResults && !replaying && (
          <div className={`mt-4 p-3 rounded-lg border ${
            replayResults.every(r => r.success)
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-yellow-500/10 border-yellow-500/20'
          }`}>
            <p className={`text-xs font-medium ${
              replayResults.every(r => r.success) ? 'text-emerald-400' : 'text-yellow-400'
            }`}>
              Replay complete: {replayResults.filter(r => r.success).length}/{replayResults.length} steps succeeded
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-white/10 space-y-2">
        {!saved ? (
          <>
            <button
              onClick={handleSave}
              disabled={replaying}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-[#5E5CE6] to-[#C2C1FF] text-white text-sm font-bold rounded-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-40"
            >
              Save Workflow
            </button>
            <button
              onClick={handleReplay}
              disabled={replaying}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 text-[#C2C1FF] text-sm font-medium rounded-lg hover:bg-white/10 transition-all disabled:opacity-40"
            >
              {replaying ? 'Replaying...' : 'Replay Now'}
            </button>
            <button
              onClick={onDiscard}
              disabled={replaying}
              className="w-full px-4 py-2 text-slate-400 text-sm hover:text-white transition-colors disabled:opacity-40"
            >
              Discard
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleReplay}
              disabled={replaying}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-[#5E5CE6] to-[#C2C1FF] text-white text-sm font-bold rounded-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-40"
            >
              {replaying ? 'Replaying...' : 'Replay Workflow'}
            </button>
            <button
              onClick={onBack}
              className="w-full px-4 py-2 text-slate-400 text-sm hover:text-white transition-colors"
            >
              Back to Chat
            </button>
          </>
        )}
      </div>
    </div>
  )
}

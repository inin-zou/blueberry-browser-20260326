import React from 'react'

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
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return `${m}:${String(s % 60).padStart(2, '0')}`
  }

  const getStepLabel = (step: WorkflowStep) => {
    switch (step.action) {
      case 'navigate': return `Navigated to ${step.data.url ? new URL(step.data.url).hostname : 'page'}`
      case 'click': return `Clicked element`
      case 'type': return `Typed "${(step.data.value || '').substring(0, 30)}${(step.data.value || '').length > 30 ? '...' : ''}"`
      case 'scroll': return 'Scrolled page'
      default: return step.action
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#C2C1FF]">Workflow Recorded</h2>
          <span className="text-[10px] font-mono text-slate-500">
            {recording.actions.length} steps • {formatTime(recording.duration)}
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
          {recording.actions.map((step, i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-[#5E5CE6]/20 border border-[#5E5CE6]/30 flex items-center justify-center text-[10px] text-[#C2C1FF]">
                  {step.step}
                </div>
                {i < recording.actions.length - 1 && (
                  <div className="w-px h-4 bg-white/10 mt-1"></div>
                )}
              </div>
              {/* Step content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">{getStepLabel(step)}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {formatTime(step.timestamp - (recording.actions[0]?.timestamp || 0))} • {step.action}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <button
          onClick={onSave}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-[#5E5CE6] to-[#C2C1FF] text-white text-sm font-bold rounded-lg hover:scale-[1.02] active:scale-95 transition-transform"
        >
          Make Replayable
        </button>
        <button
          onClick={onDiscard}
          className="w-full px-4 py-2 text-slate-400 text-sm hover:text-white transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

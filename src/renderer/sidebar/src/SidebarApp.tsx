import React, { useEffect, useState } from 'react'
import { ChatProvider } from './contexts/ChatContext'
import { Chat } from './components/Chat'
import { SynthesisView } from './components/SynthesisView'
import { SandboxResultView } from './components/SandboxResultView'
import { WorkflowReplayPlayer } from './components/WorkflowReplayPlayer'
import { OnboardingFlow } from './components/OnboardingFlow'
import { useDarkMode } from '@common/hooks/useDarkMode'

type SidebarView = 'chat' | 'synthesis' | 'sandbox' | 'workflow' | 'onboarding'

interface SynthesisResult {
  sourceTabs: { id: string; url: string; title: string }[]
  comparisonTable: {
    headers: string[]
    rows: { label: string; values: string[] }[]
  }
  recommendation: string
}

interface SandboxResult {
  id: string
  status: 'success' | 'error' | 'timeout'
  output: any
  consoleOutput: string[]
  error?: string
  executionTimeMs: number
  script: string
}

interface WorkflowRecording {
  id: string
  name?: string
  duration: number
  actions: {
    step: number
    timestamp: number
    action: string
    data: {
      url?: string
      selector?: string
      value?: string
      position?: { x: number; y: number }
    }
  }[]
  tabId: string
}

const SidebarContent: React.FC = () => {
    const { isDarkMode } = useDarkMode()
    const [view, setView] = useState<SidebarView>('chat')
    const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null)
    const [synthesisPending, setSynthesisPending] = useState(false)
    const [offerTabCount, setOfferTabCount] = useState(0)
    const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null)
    const [workflowRecording, setWorkflowRecording] = useState<WorkflowRecording | null>(null)

    // Apply dark mode class to the document
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [isDarkMode])

    // Check if user has completed onboarding
    useEffect(() => {
        const onboarded = localStorage.getItem('blueberry-onboarded')
        if (!onboarded) {
            setView('onboarding')
        }
    }, [])

    // Listen for synthesis offers from the main process
    useEffect(() => {
        const api = (window as any).sidebarAPI
        if (!api?.onSynthesisOffer) return

        api.onSynthesisOffer((data: { tabCount: number; timestamp: number }) => {
            setOfferTabCount(data.tabCount)
            setSynthesisPending(true)
        })

        return () => {
            api.removeSynthesisOfferListener?.()
        }
    }, [])

    const handleAcceptSynthesisOffer = async () => {
        setSynthesisPending(false)
        const api = (window as any).sidebarAPI
        if (!api?.requestSynthesis) return

        try {
            const result = await api.requestSynthesis()
            if (result) {
                setSynthesisResult(result)
                setView('synthesis')
            }
        } catch (err) {
            console.error('Synthesis request failed:', err)
        }
    }

    const handleDismissSynthesisOffer = () => {
        setSynthesisPending(false)
    }

    const handleBackToChat = () => {
        setView('chat')
    }

    const handleOnboardingComplete = () => {
        localStorage.setItem('blueberry-onboarded', 'true')
        setView('chat')
    }

    const handleOnboardingSkip = () => {
        localStorage.setItem('blueberry-onboarded', 'true')
        setView('chat')
    }

    const handleSandboxResult = (result: SandboxResult) => {
        setSandboxResult(result)
        setView('sandbox')
    }

    const handleSandboxApply = () => {
        if (sandboxResult) {
            window.sidebarAPI.applySandbox(sandboxResult.script)
        }
        setView('chat')
    }

    const handleWorkflowRecorded = (recording: WorkflowRecording) => {
        setWorkflowRecording(recording)
        setView('workflow')
    }

    const handleWorkflowSave = async () => {
        if (!workflowRecording) return
        try {
            await window.sidebarAPI.saveWorkflow({
                recording: workflowRecording,
                name: workflowRecording.name || 'Untitled Workflow',
                summary: `Workflow with ${workflowRecording.actions.length} steps`,
            })
        } catch (err) {
            console.error('Failed to save workflow:', err)
        }
        setView('chat')
    }

    const handleWorkflowDiscard = () => {
        setWorkflowRecording(null)
        setView('chat')
    }

    // Expose handlers to Chat component via context or direct prop passing is not possible,
    // so we expose them on a window-level event bus for Chat to call back
    useEffect(() => {
        const handleSandboxEvent = (e: CustomEvent) => handleSandboxResult(e.detail)
        const handleWorkflowEvent = (e: CustomEvent) => handleWorkflowRecorded(e.detail)
        window.addEventListener('sidebar:sandbox-result', handleSandboxEvent as EventListener)
        window.addEventListener('sidebar:workflow-recorded', handleWorkflowEvent as EventListener)
        return () => {
            window.removeEventListener('sidebar:sandbox-result', handleSandboxEvent as EventListener)
            window.removeEventListener('sidebar:workflow-recorded', handleWorkflowEvent as EventListener)
        }
    }, [])

    return (
        <div className="h-screen flex flex-col bg-background border-l border-border relative">
            {/* Synthesis offer banner */}
            {synthesisPending && view === 'chat' && (
                <div className="absolute top-0 left-0 right-0 z-10 mx-3 mt-3 p-3 rounded-lg bg-[#1e1d3a] border border-[#5E5CE6]/40 shadow-lg animate-fade-in">
                    <p className="text-xs text-[#C2C1FF] font-medium mb-2">
                        Comparing {offerTabCount} tabs? Generate a comparison table?
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAcceptSynthesisOffer}
                            className="text-[11px] px-3 py-1 rounded bg-[#5E5CE6] text-white hover:bg-[#6e6cf6] transition-colors"
                        >
                            Compare tabs
                        </button>
                        <button
                            onClick={handleDismissSynthesisOffer}
                            className="text-[11px] px-3 py-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {view === 'onboarding' && (
                <OnboardingFlow
                    onComplete={handleOnboardingComplete}
                    onSkip={handleOnboardingSkip}
                />
            )}

            {view === 'chat' && <Chat />}

            {view === 'synthesis' && synthesisResult && (
                <SynthesisView result={synthesisResult} onBack={handleBackToChat} />
            )}

            {view === 'sandbox' && sandboxResult && (
                <SandboxResultView
                    result={sandboxResult}
                    onApply={handleSandboxApply}
                    onBack={handleBackToChat}
                />
            )}

            {view === 'workflow' && workflowRecording && (
                <WorkflowReplayPlayer
                    recording={workflowRecording}
                    onSave={handleWorkflowSave}
                    onDiscard={handleWorkflowDiscard}
                    onBack={handleBackToChat}
                />
            )}
        </div>
    )
}

export const SidebarApp: React.FC = () => {
    return (
        <ChatProvider>
            <SidebarContent />
        </ChatProvider>
    )
}

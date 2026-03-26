import React, { useEffect, useState } from 'react'
import { ChatProvider } from './contexts/ChatContext'
import { Chat } from './components/Chat'
import { SynthesisView } from './components/SynthesisView'
import { useDarkMode } from '@common/hooks/useDarkMode'

type SidebarView = 'chat' | 'synthesis'

interface SynthesisResult {
  sourceTabs: { id: string; url: string; title: string }[]
  comparisonTable: {
    headers: string[]
    rows: { label: string; values: string[] }[]
  }
  recommendation: string
}

const SidebarContent: React.FC = () => {
    const { isDarkMode } = useDarkMode()
    const [view, setView] = useState<SidebarView>('chat')
    const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null)
    const [synthesisPending, setSynthesisPending] = useState(false)
    const [offerTabCount, setOfferTabCount] = useState(0)

    // Apply dark mode class to the document
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [isDarkMode])

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

            {view === 'chat' && <Chat />}
            {view === 'synthesis' && synthesisResult && (
                <SynthesisView result={synthesisResult} onBack={handleBackToChat} />
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

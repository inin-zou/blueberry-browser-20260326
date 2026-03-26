import React, { useState, useEffect } from 'react'

interface Browser {
  id: string
  name: string
  available: boolean
}

interface OnboardingFlowProps {
  onComplete: () => void
  onSkip: () => void
}

export function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [browsers, setBrowsers] = useState<Browser[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')

  useEffect(() => {
    window.sidebarAPI.getAvailableBrowsers().then((b: Browser[]) => {
      setBrowsers(b)
      // Auto-select available browsers
      const available = new Set(b.filter(br => br.available).map(br => br.id))
      setSelected(available)
    })
  }, [])

  const [importResult, setImportResult] = useState<{ urlCount: number; interests: string[] } | null>(null)

  const handleImport = async () => {
    setImporting(true)
    setProgress('Copying browser history...')
    try {
      setTimeout(() => setProgress('Analyzing browsing patterns...'), 500)
      const result = await window.sidebarAPI.importHistory(Array.from(selected))
      setProgress('')
      setImportResult({
        urlCount: result.urlCount,
        interests: result.profile?.inferredInterests || [],
      })
    } catch {
      setProgress('Import failed. You can try again later.')
      setTimeout(onComplete, 3000)
    }
  }

  const toggleBrowser = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  // Success state — show profile summary
  if (importResult) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 text-2xl">&#10003;</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#e4e1e9]">Profile Built</h2>
            <p className="text-sm text-[#c7c4d7]">
              Analyzed {importResult.urlCount.toLocaleString()} URLs from your browsing history.
            </p>
          </div>

          {importResult.interests.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-[#918fa0] uppercase tracking-wider">Your interests</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {importResult.interests.map((interest, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 text-xs rounded-full bg-[#5E5CE6]/15 text-[#C2C1FF] border border-[#5E5CE6]/20"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-[#918fa0]">
            The AI co-pilot will tailor responses to your areas of interest.
          </p>

          <button
            onClick={onComplete}
            className="w-full px-5 py-2.5 bg-gradient-to-r from-[#5E5CE6] to-[#C2C1FF] text-white text-sm font-bold rounded-lg hover:scale-[1.02] active:scale-95 transition-transform"
          >
            Start Browsing
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-[#5E5CE6] to-[#C2C1FF] flex items-center justify-center">
            <span className="text-white text-xl font-bold">B</span>
          </div>
          <h2 className="text-lg font-bold text-[#e4e1e9]">Welcome to Blueberry</h2>
          <p className="text-sm text-[#c7c4d7]">
            Import your browsing history to personalize the AI experience. Everything stays on your device.
          </p>
        </div>

        <div className="space-y-2">
          {browsers.map(b => (
            <label
              key={b.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                b.available
                  ? selected.has(b.id)
                    ? 'border-[#5E5CE6]/30 bg-[#5E5CE6]/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                  : 'border-white/5 bg-white/3 opacity-40 cursor-not-allowed'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-[#e4e1e9]">{b.name}</p>
                <p className="text-[10px] font-mono text-[#918fa0]">
                  {b.available ? 'Available' : 'Not installed'}
                </p>
              </div>
              {b.available && (
                <input
                  type="checkbox"
                  checked={selected.has(b.id)}
                  onChange={() => toggleBrowser(b.id)}
                  className="rounded border-[#464554] bg-transparent text-[#5E5CE6] focus:ring-[#5E5CE6]/40"
                />
              )}
            </label>
          ))}
        </div>

        {progress && (
          <div className="space-y-2">
            <p className="text-xs text-center text-[#c7c4d7] font-mono">{progress}</p>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#5E5CE6] to-[#C2C1FF] rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onSkip}
            disabled={importing}
            className="text-sm text-[#918fa0] hover:text-[#e4e1e9] transition-colors disabled:opacity-40"
          >
            Skip for now
          </button>
          <button
            onClick={handleImport}
            disabled={importing || selected.size === 0}
            className="px-5 py-2 bg-gradient-to-r from-[#5E5CE6] to-[#C2C1FF] text-white text-sm font-bold rounded-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing...' : 'Import Selected'}
          </button>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
          <span className="text-[#5E5CE6] text-sm">*</span>
          <p className="text-[10px] text-[#918fa0]">
            Your data never leaves your device. Blueberry processes everything locally.
          </p>
        </div>
      </div>
    </div>
  )
}

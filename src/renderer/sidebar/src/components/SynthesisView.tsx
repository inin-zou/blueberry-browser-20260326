import React from 'react'

interface SynthesisViewProps {
  result: {
    sourceTabs: { id: string; url: string; title: string }[]
    comparisonTable: {
      headers: string[]
      rows: { label: string; values: string[] }[]
    }
    recommendation: string
  }
  onBack: () => void
}

export function SynthesisView({ result, onBack }: SynthesisViewProps) {
  const { sourceTabs, comparisonTable, recommendation } = result

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#C2C1FF]">
            Comparing {sourceTabs.length} Tabs
          </h2>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Cross-tab Synthesis • AI Generated
          </span>
        </div>
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/5 transition-all"
        >
          ← Chat
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {comparisonTable.headers.map((h, i) => (
                <th
                  key={i}
                  className="text-left py-2 px-2 text-[10px] font-mono uppercase text-slate-500 tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonTable.rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="py-2 px-2 font-medium text-[#C2C1FF]">{row.label}</td>
                {row.values.map((val, j) => (
                  <td key={j} className="py-2 px-2 text-slate-300">
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Recommendation */}
        {recommendation && (
          <div className="mt-4 p-3 bg-white/5 border-l-2 border-[#5E5CE6] rounded-r-lg">
            <p className="text-xs font-bold text-[#C2C1FF] mb-1">Recommendation</p>
            <p className="text-sm text-slate-300">{recommendation}</p>
          </div>
        )}
      </div>
    </div>
  )
}

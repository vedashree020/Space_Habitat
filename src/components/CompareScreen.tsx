import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { ArrowLeft, Trash2, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { StoredLayout } from '../storage';

interface Props {
  layouts: StoredLayout[];
  onBack: () => void;
  onDelete: (id: string) => void;
}

export default function CompareScreen({ layouts, onBack, onDelete }: Props) {
  const [selA, setSelA] = useState(0);
  const [selB, setSelB] = useState(Math.min(1, layouts.length - 1));

  if (layouts.length === 0) {
    return (
      <div className="min-h-screen bg-navy-950 starfield flex items-center justify-center">
        <div className="text-center">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">No saved layouts to compare.</p>
          <button onClick={onBack} className="text-cyan-glow text-sm hover:underline">Go back to editor</button>
        </div>
      </div>
    );
  }

  const layoutA = layouts[Math.min(selA, layouts.length - 1)];
  const layoutB = layouts[Math.min(selB, layouts.length - 1)];

  const chartData = [
    { metric: 'Health Score', A: layoutA.score, B: layoutB.score },
    { metric: 'Conflicts', A: layoutA.conflictsCount, B: layoutB.conflictsCount },
  ];

  return (
    <div className="min-h-screen bg-navy-950 starfield nebula">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-cyan/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800/60 border border-slate-700/50 text-xs text-slate-300 hover:border-cyan-glow/40 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Editor
          </button>
          <h1 className="text-sm font-semibold text-white">Layout Comparison</h1>
        </div>
        <span className="text-xs text-slate-500 font-mono">{layouts.length} saved layout(s)</span>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Layout selectors */}
        <div className="flex items-center gap-4 mb-6">
          <LayoutSelector layouts={layouts} value={selA} onChange={setSelA} label="Layout A" color="#22d3ee" />
          <div className="text-slate-600 text-xl font-light">vs</div>
          <LayoutSelector layouts={layouts} value={selB} onChange={setSelB} label="Layout B" color="#a855f7" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <LayoutPreview layout={layoutA} accent="#22d3ee" onDelete={() => onDelete(layoutA.id)} />
          <LayoutPreview layout={layoutB} accent="#a855f7" onDelete={() => onDelete(layoutB.id)} />
        </div>

        {/* Bar chart */}
        <div className="glass rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Score Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,211,238,0.1)" />
              <XAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <RTooltip
                contentStyle={{ background: '#0a1320', border: '1px solid rgba(34,211,238,0.3)', borderRadius: '8px', fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Bar dataKey="A" name={layoutA.name} fill="#22d3ee" radius={[4, 4, 0, 0]} />
              <Bar dataKey="B" name={layoutB.name} fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conflicts table */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Conflict Summary</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400">
                <th className="text-left py-2 px-3 font-medium">Layout</th>
                <th className="text-center py-2 px-3 font-medium">Score</th>
                <th className="text-center py-2 px-3 font-medium">Conflicts</th>
                <th className="text-center py-2 px-3 font-medium">Zones</th>
                <th className="text-right py-2 px-3 font-medium">Mission</th>
              </tr>
            </thead>
            <tbody>
              {[layoutA, layoutB].map((l) => (
                <tr key={l.id} className="border-b border-slate-800/50 hover:bg-navy-800/30">
                  <td className="py-2.5 px-3 text-slate-200 font-medium">{l.name}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={l.score >= 75 ? 'text-status-ok' : l.score >= 50 ? 'text-status-warn' : 'text-status-danger'}>
                      {l.score}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {l.conflictsCount === 0 ? (
                      <span className="text-status-ok flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> 0
                      </span>
                    ) : (
                      <span className="text-status-warn flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {l.conflictsCount}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-300">{l.zones.length}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{l.config.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LayoutSelector({ layouts, value, onChange, label, color }: {
  layouts: StoredLayout[]; value: number; onChange: (v: number) => void; label: string; color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono uppercase" style={{ color }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="px-3 py-1.5 rounded-lg bg-navy-800 border border-slate-700/50 text-sm text-white outline-none focus:border-cyan-glow/50"
      >
        {layouts.map((l, i) => (
          <option key={l.id} value={i}>{l.name} (Score: {l.score})</option>
        ))}
      </select>
    </div>
  );
}

function LayoutPreview({ layout, accent, onDelete }: { layout: StoredLayout; accent: string; onDelete: () => void }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
          <span className="text-sm font-semibold text-white">{layout.name}</span>
        </div>
        <button onClick={onDelete} className="text-slate-500 hover:text-status-danger transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mini canvas preview */}
      <div className="relative rounded-lg overflow-hidden mb-3" style={{ background: 'radial-gradient(ellipse at center, #0a1320, #04070d)', aspectRatio: '720/540' }}>
        <svg viewBox="0 0 720 540" className="w-full h-full">
          {layout.zones.map((z) => (
            <g key={z.id}>
              <rect
                x={z.x}
                y={z.y}
                width={z.width}
                height={z.height}
                fill={`${z.color}22`}
                stroke={z.color}
                strokeWidth={1}
                rx={4}
              />
              <text x={z.x + 4} y={z.y + 14} fontSize={10} fill={z.color} fontWeight="bold">{z.label}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-navy-800/50 py-2">
          <div className="text-lg font-bold text-white font-mono">{layout.score}</div>
          <div className="text-[10px] text-slate-500">Score</div>
        </div>
        <div className="rounded-lg bg-navy-800/50 py-2">
          <div className="text-lg font-bold text-white font-mono">{layout.zones.length}</div>
          <div className="text-[10px] text-slate-500">Zones</div>
        </div>
        <div className="rounded-lg bg-navy-800/50 py-2">
          <div className="text-lg font-bold font-mono" style={{ color: layout.conflictsCount === 0 ? '#22c55e' : '#f59e0b' }}>
            {layout.conflictsCount}
          </div>
          <div className="text-[10px] text-slate-500">Conflicts</div>
        </div>
      </div>
    </div>
  );
}

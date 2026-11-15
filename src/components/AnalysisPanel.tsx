import { useEffect, useState } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { CheckCircle2, XCircle, Wrench, Activity, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { ScoreMetrics, RuleCheck, SmartFix, Conflict } from '../types';
import { Tooltip } from './Tooltip';

interface Props {
  score: number;
  prevScore: number;
  metrics: ScoreMetrics;
  rules: RuleCheck[];
  fixes: SmartFix[];
  conflicts: Conflict[];
  onApplyFix: (fix: SmartFix) => void;
}

export default function AnalysisPanel({ score, prevScore, metrics, rules, fixes, conflicts, onApplyFix }: Props) {
  const [displayScore, setDisplayScore] = useState(score);

  useEffect(() => {
    if (displayScore === score) return;
    const diff = score - displayScore;
    const step = diff / 12;
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      if (frame >= 12) {
        setDisplayScore(score);
        clearInterval(interval);
      } else {
        setDisplayScore((prev) => Math.round(prev + step));
      }
    }, 30);
    return () => clearInterval(interval);
  }, [score]);

  const radarData = [
    { metric: 'Safety', value: metrics.safety },
    { metric: 'Access', value: metrics.accessibility },
    { metric: 'Acoustic', value: metrics.acoustic },
    { metric: 'Efficiency', value: metrics.efficiency },
    { metric: 'Compliance', value: metrics.compliance },
  ];

  const scoreColor = displayScore >= 75 ? '#22c55e' : displayScore >= 50 ? '#f59e0b' : '#ef4444';
  const passed = rules.filter((r) => r.passed).length;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto panel-scroll pr-1">
      {/* Score Gauge */}
      <div className="glass rounded-xl p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-cyan-glow" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Habitat Health Score</span>
        </div>
        <ScoreGauge score={displayScore} color={scoreColor} />
        <div className="flex items-center justify-center gap-2 mt-2">
          {score !== prevScore && (
            <span
              className={`text-xs font-mono animate-fade-in ${score > prevScore ? 'text-status-ok' : 'text-status-danger'}`}
            >
              {score > prevScore ? '▲' : '▼'} {Math.abs(score - prevScore)}
            </span>
          )}
          <span className="text-xs text-slate-500 font-mono">{passed}/{rules.length} rules passed</span>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="glass rounded-xl p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-cyan-glow" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Performance Profile</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <PolarGrid stroke="rgba(34,211,238,0.15)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} stroke="rgba(34,211,238,0.1)" />
            <Radar dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Rule Checklist */}
      <div className="glass rounded-xl p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-cyan-glow" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Safety Checklist</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {rules.map((r) => (
            <Tooltip key={r.id} text={r.detail} side="left">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-navy-800/40 hover:bg-navy-800/70 transition-colors cursor-default">
                {r.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-status-ok shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-status-danger shrink-0" />
                )}
                <span className={`text-[11px] flex-1 ${r.passed ? 'text-slate-300' : 'text-slate-400'}`}>
                  {r.label}
                </span>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="glass rounded-xl p-4 animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-status-warn" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Active Conflicts ({conflicts.length})</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-navy-800/40">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${c.severity === 'high' ? 'bg-status-danger' : 'bg-status-warn'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-slate-300">{c.labelA} ↔ {c.labelB}</div>
                  <div className="text-[10px] text-slate-500">{c.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Fixes */}
      <div className="glass rounded-xl p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-cyan-glow" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Smart Fixes</span>
        </div>
        {fixes.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-8 h-8 text-status-ok mx-auto mb-2" />
            <p className="text-xs text-slate-400">All clear! No fixes needed.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {fixes.map((f) => (
              <div key={f.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-navy-800/50 border border-cyan-glow/10 hover:border-cyan-glow/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-slate-200">{f.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{f.detail}</div>
                </div>
                <button
                  onClick={() => onApplyFix(f)}
                  className="px-2.5 py-1 rounded-md bg-cyan-glow/15 border border-cyan-glow/30 text-[10px] font-semibold text-cyan-glow hover:bg-cyan-glow/25 transition-colors whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="8" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease', filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white font-mono" style={{ transition: 'color 0.3s' }}>
          {score}
        </span>
        <span className="text-[10px] text-slate-500 font-mono uppercase">/ 100</span>
      </div>
    </div>
  );
}

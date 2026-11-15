import { useEffect, useRef, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { CheckCircle2, XCircle, Wrench, Activity, ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import type { ScoreMetrics, RuleCheck, SmartFix, Conflict, ScoreMethodology } from '../types';
import { Tooltip } from './Tooltip';

interface Props {
  score: number;
  prevScore: number;
  metrics: ScoreMetrics;
  rules: RuleCheck[];
  fixes: SmartFix[];
  conflicts: Conflict[];
  methodology: ScoreMethodology;
  onApplyFix: (fix: SmartFix) => void;
  onConflictClick: (conflict: Conflict) => void;
}

export default function AnalysisPanel({ score, prevScore, metrics, rules, fixes, conflicts, methodology, onApplyFix, onConflictClick }: Props) {
  const [displayScore, setDisplayScore] = useState(score);
  const displayScoreRef = useRef(score);
  const [showMethodology, setShowMethodology] = useState(false);

  useEffect(() => {
    const start = displayScoreRef.current;
    if (start === score) return;
    const diff = score - start;
    let frame = 0;
    const interval = window.setInterval(() => {
      frame += 1;
      const next = frame >= 12 ? score : Math.round(start + diff * (frame / 12));
      displayScoreRef.current = next;
      setDisplayScore(next);
      if (frame >= 12) window.clearInterval(interval);
    }, 30);
    return () => window.clearInterval(interval);
  }, [score]);

  const radarData = [
    { metric: 'Safety', value: metrics.safety },
    { metric: 'Access', value: metrics.accessibility },
    { metric: 'Acoustic', value: metrics.acoustic },
    { metric: 'Efficiency', value: metrics.efficiency },
    { metric: 'Compliance', value: metrics.compliance },
  ];
  const scoreColor = displayScore >= 75 ? '#22c55e' : displayScore >= 50 ? '#f59e0b' : '#ef4444';
  const passed = rules.filter((r) => r.status === 'pass').length;
  const warnings = rules.filter((r) => r.status === 'warn').length;
  const failed = rules.filter((r) => r.status === 'fail').length;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto panel-scroll pr-1">
      <div className="glass rounded-xl p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-cyan-glow" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Habitat Health Score</span>
        </div>
        <ScoreGauge score={displayScore} color={scoreColor} />
        <div className="flex items-center justify-center gap-2 mt-2">
          {score !== prevScore && <span className={`text-xs font-mono ${score > prevScore ? 'text-status-ok' : 'text-status-danger'}`}>{score > prevScore ? '▲' : '▼'} {Math.abs(score - prevScore)}</span>}
          <span className="text-xs text-slate-500 font-mono">{passed}/{rules.length} passed</span>
        </div>
        <button onClick={() => setShowMethodology(!showMethodology)} className="w-full mt-3 flex items-center justify-center gap-1.5 text-[10px] text-cyan-glow/80 hover:text-cyan-glow">
          <Info className="w-3 h-3" /> {showMethodology ? 'Hide scoring methodology' : 'How is this score calculated?'}
        </button>
        {showMethodology && <Methodology methodology={methodology} />}
      </div>

      <div className="glass rounded-xl p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4 text-cyan-glow" /><span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Performance Profile</span></div>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <PolarGrid stroke="rgba(34,211,238,0.15)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} stroke="rgba(34,211,238,0.1)" />
            <Radar dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl p-4 animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-glow" /><span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Safety Checklist</span></div>
          <div className="flex gap-1.5 text-[9px] font-mono"><span className="text-status-ok">{passed} PASS</span><span className="text-status-warn">{warnings} WARN</span><span className="text-status-danger">{failed} FAIL</span></div>
        </div>
        <div className="flex flex-col gap-1.5">
          {rules.map((r) => <RuleRow key={r.id} rule={r} />)}
        </div>
      </div>

      {conflicts.length > 0 && <div className="glass rounded-xl p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-status-warn" /><span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Active Conflicts ({conflicts.length})</span></div>
        <div className="flex flex-col gap-1.5">
          {conflicts.map((c, i) => <button key={`${c.ruleId}-${i}`} onClick={() => onConflictClick(c)} className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg bg-navy-800/40 hover:bg-cyan-glow/10 text-left transition-colors">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${c.severity === 'high' ? 'bg-status-danger' : 'bg-status-warn'}`} />
            <div className="flex-1 min-w-0"><div className="text-[11px] text-slate-300">{c.labelA} ↔ {c.labelB}</div><div className="text-[10px] text-slate-500">{c.reason}</div><div className="text-[9px] text-cyan-glow/60 font-mono mt-0.5">Click to highlight zones · {Math.round(c.distance)}px</div></div>
          </button>)}
        </div>
      </div>}

      <div className="glass rounded-xl p-4 animate-slide-up">
        <div className="flex items-center gap-2 mb-3"><Wrench className="w-4 h-4 text-cyan-glow" /><span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Smart Fixes</span></div>
        {fixes.length === 0 ? <div className="text-center py-4"><CheckCircle2 className="w-8 h-8 text-status-ok mx-auto mb-2" /><p className="text-xs text-slate-400">All clear! No fixes needed.</p></div> : <div className="flex flex-col gap-2">{fixes.map((f) => <div key={f.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-navy-800/50 border border-cyan-glow/10 hover:border-cyan-glow/30 transition-colors"><div className="flex-1 min-w-0"><div className="text-[11px] font-medium text-slate-200">{f.label}</div><div className="text-[10px] text-slate-500 truncate">{f.detail}</div></div><button onClick={() => onApplyFix(f)} className="px-2.5 py-1 rounded-md bg-cyan-glow/15 border border-cyan-glow/30 text-[10px] font-semibold text-cyan-glow hover:bg-cyan-glow/25 transition-colors whitespace-nowrap">Apply</button></div>)}</div>}
      </div>
    </div>
  );
}

function RuleRow({ rule }: { rule: RuleCheck }) {
  const icon = rule.status === 'pass' ? <CheckCircle2 className="w-3.5 h-3.5 text-status-ok shrink-0" /> : rule.status === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 text-status-warn shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-status-danger shrink-0" />;
  return <Tooltip text={rule.detail} side="left"><div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-navy-800/40 hover:bg-navy-800/70 transition-colors cursor-default">{icon}<span className={`text-[11px] flex-1 ${rule.status === 'pass' ? 'text-slate-300' : rule.status === 'warn' ? 'text-status-warn/90' : 'text-status-danger/90'}`}>{rule.label}</span><span className="text-[9px] font-mono uppercase text-slate-600">{rule.status}</span></div></Tooltip>;
}

function Methodology({ methodology }: { methodology: ScoreMethodology }) {
  return <div className="mt-3 rounded-lg bg-navy-800/60 border border-cyan-glow/10 p-2.5"><div className="text-[10px] text-slate-400 mb-2">Weighted sum from live layout state</div>{methodology.factors.map((factor) => <div key={factor.metric} className="flex items-center justify-between gap-2 text-[9px] py-0.5"><span className="text-slate-400">{factor.metric} ({Math.round(methodology.weights[factor.metric.toLowerCase() as keyof typeof methodology.weights] * 100)}%)</span><span className="font-mono text-cyan-glow">{factor.value}</span></div>)}<div className="text-[9px] text-slate-600 mt-2">Engineering assumptions are simplified for this prototype.</div></div>;
}

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}><svg width="140" height="140" className="-rotate-90"><circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="8" /><circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease', filter: `drop-shadow(0 0 6px ${color}80)` }} /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold text-white font-mono">{score}</span><span className="text-[10px] text-slate-500 font-mono uppercase">/ 100</span></div></div>;
}

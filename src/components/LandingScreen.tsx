import { useState } from 'react';
import { Satellite, Users, Shapes, ArrowRight, Zap, Moon, Rocket, Mountain } from 'lucide-react';
import type { MissionType, HabitatShape, MissionConfig } from '../types';
import { MISSION_DEFS } from '../data';
import type { LucideIcon } from 'lucide-react';

const MISSION_ICONS: Record<string, LucideIcon> = { Moon, Rocket, Mountain, Satellite };

interface Props {
  onStart: (config: MissionConfig) => void;
}

export default function LandingScreen({ onStart }: Props) {
  const [mission, setMission] = useState<MissionType>('orbital');
  const [crewSize, setCrewSize] = useState(4);
  const [shape, setShape] = useState<HabitatShape>('rectangle');

  const selectedDef = MISSION_DEFS.find((m) => m.type === mission)!;

  return (
    <div className="min-h-screen w-full bg-navy-950 starfield nebula overflow-y-auto">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-cyan/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-glow to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-glow/20">
            <Satellite className="w-5 h-5 text-navy-950" />
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-tight">HabitatOS</span>
            <span className="text-xs text-cyan-glow/60 ml-2 font-mono">v1.0</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse-glow text-status-ok" />
          SYSTEMS NOMINAL
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-8 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-glow/10 border border-cyan-glow/20 text-xs text-cyan-glow font-mono mb-6">
          <Zap className="w-3.5 h-3.5" />
          SPACE HABITAT DESIGN PLATFORM
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight mb-4">
          Design habitats that keep<br />crews <span className="text-cyan-glow">alive</span> and <span className="text-cyan-glow">productive</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Mission-aware design + automated safety checks + intelligent optimization.
        </p>
      </div>

      {/* Setup cards */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="glass rounded-2xl p-6 md:p-8 animate-slide-up">
          {/* Mission type */}
          <div className="mb-8">
            <label className="text-sm font-semibold text-slate-300 mb-3 block">Select Mission Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {MISSION_DEFS.map((m) => {
                const Icon = MISSION_ICONS[m.icon] || Satellite;
                const active = mission === m.type;
                return (
                  <button
                    key={m.type}
                    onClick={() => setMission(m.type)}
                    className={`group relative rounded-xl p-4 text-left border transition-all duration-200 ${
                      active
                        ? 'border-cyan-glow bg-cyan-glow/10 shadow-lg shadow-cyan-glow/10'
                        : 'border-slate-700/50 bg-navy-800/50 hover:border-cyan-glow/40 hover:bg-navy-800/80'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${m.gradient} flex items-center justify-center mb-3 ${active ? 'scale-110' : ''} transition-transform`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-sm font-semibold text-white">{m.label}</div>
                    <div className="text-xs text-slate-400 mt-1">{m.desc}</div>
                    {active && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-cyan-glow animate-pulse-glow text-cyan-glow" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Crew size + shape */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-glow" /> Crew Size
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={2}
                  max={8}
                  value={crewSize}
                  onChange={(e) => setCrewSize(Number(e.target.value))}
                  className="flex-1 accent-cyan-glow"
                />
                <div className="w-16 text-center py-1.5 rounded-lg bg-navy-800 border border-cyan-glow/20 text-white font-mono text-lg font-semibold">
                  {crewSize}
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Shapes className="w-4 h-4 text-cyan-glow" /> Habitat Shape
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['rectangle', 'circle', 'l-shape'] as HabitatShape[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setShape(s)}
                    className={`py-2.5 rounded-lg text-xs font-medium border transition-all ${
                      shape === s
                        ? 'border-cyan-glow bg-cyan-glow/10 text-cyan-glow'
                        : 'border-slate-700/50 bg-navy-800/50 text-slate-400 hover:text-white hover:border-slate-500'
                    }`}
                  >
                    {s === 'rectangle' ? 'Rectangle' : s === 'circle' ? 'Circle' : 'L-Shape'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Start */}
          <button
            onClick={() => onStart({ type: mission, label: selectedDef.label, crewSize, shape })}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-glow to-blue-600 text-navy-950 font-bold text-sm tracking-wide flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-cyan-glow/20 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            START DESIGNING
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6 font-mono">
          Frontend prototype · All data in-browser · No backend required
        </p>
      </div>
    </div>
  );
}


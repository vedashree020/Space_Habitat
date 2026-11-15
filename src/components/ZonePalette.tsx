import { ICONS } from '../icons';
import { ZONE_DEFS } from '../data';
import type { ZoneType } from '../types';
import { Tooltip } from './Tooltip';

interface Props {
  selectedTool: ZoneType | null;
  onSelectTool: (type: ZoneType | null) => void;
}

export default function ZonePalette({ selectedTool, onSelectTool }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider px-1 mb-1">
        Zone Palette
      </div>
      {ZONE_DEFS.map((z) => {
        const Icon = ICONS[z.icon];
        const active = selectedTool === z.type;
        return (
          <Tooltip key={z.type} text={`Click to select, then click canvas to place ${z.label} (noise: ${z.noiseLevel}dB)`}>
            <button
              onClick={() => onSelectTool(active ? null : z.type)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all duration-150 text-left ${
                active
                  ? 'border-cyan-glow bg-cyan-glow/10 shadow-sm shadow-cyan-glow/10'
                  : 'border-transparent bg-navy-800/40 hover:bg-navy-800/70 hover:border-slate-600/50'
              }`}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${z.color}25`, border: `1px solid ${z.color}50` }}
              >
                {Icon && <Icon className="w-3.5 h-3.5" style={{ color: z.color }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">{z.label}</div>
                <div className="text-[10px] text-slate-500 font-mono">{z.noiseLevel}dB</div>
              </div>
              {active && (
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-glow animate-pulse-glow text-cyan-glow" />
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

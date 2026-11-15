import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Satellite, Save, FileDown, Thermometer, Route, Grid3x3,
  Trash2, Info, Sparkles, Crosshair,
} from 'lucide-react';
import type { PlacedZone, MissionConfig, Conflict, ZoneType } from '../types';
import { CANVAS_W, CANVAS_H, ZONE_MAP } from '../data';
import {
  detectConflicts, calcMetrics, calcScore, checkRules, generateSmartFixes, snapToGrid,
} from '../analysis';
import { createZone, getStoredLayouts, storeLayout, type StoredLayout } from '../storage';
import { Tooltip } from './Tooltip';
import ZonePalette from './ZonePalette';
import HabitatCanvas from './HabitatCanvas';
import AnalysisPanel from './AnalysisPanel';

interface Props {
  config: MissionConfig;
  initialZones: PlacedZone[];
  onGoHome: () => void;
  onGoCompare: (layouts: StoredLayout[]) => void;
}

const LAYOUT_NAMES = ['Layout A', 'Layout B', 'Layout C', 'Layout D', 'Layout E', 'Layout F'];

export default function EditorScreen({ config, initialZones, onGoHome, onGoCompare }: Props) {
  const [zones, setZones] = useState<PlacedZone[]>(initialZones);
  const [selectedTool, setSelectedTool] = useState<ZoneType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showEgress, setShowEgress] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const conflicts: Conflict[] = useMemo(() => detectConflicts(zones), [zones]);
  const metrics = useMemo(() => calcMetrics(zones, config, conflicts), [zones, config, conflicts]);
  const score = useMemo(() => calcScore(metrics), [metrics]);
  const prevScoreRef = useRef(score);
  const [prevScore, setPrevScore] = useState(score);
  const rules = useMemo(() => checkRules(zones, config, conflicts), [zones, config, conflicts]);
  const fixes = useMemo(() => generateSmartFixes(zones, config, conflicts, rules), [zones, config, conflicts, rules]);

  // Track previous score for delta display
  useEffect(() => {
    setPrevScore(prevScoreRef.current);
    prevScoreRef.current = score;
  }, [score]);

  const handleApplyFix = useCallback((fix: typeof fixes[0]) => {
    if (fix.action === 'move' && fix.zoneId) {
      // Move zone to far corner away from conflicts
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== fix.zoneId) return z;
          // Find a spot far from other zones
          const others = prev.filter((zz) => zz.id !== z.id);
          let bestX = z.x;
          let bestY = z.y;
          let bestDist = 0;
          for (let gx = 0; gx <= CANVAS_W - z.width; gx += 40) {
            for (let gy = 0; gy <= CANVAS_H - z.height; gy += 40) {
              const cx = gx + z.width / 2;
              const cy = gy + z.height / 2;
              let minD = Infinity;
              for (const o of others) {
                const d = Math.sqrt((cx - (o.x + o.width / 2)) ** 2 + (cy - (o.y + o.height / 2)) ** 2);
                if (d < minD) minD = d;
              }
              if (minD > bestDist) {
                bestDist = minD;
                bestX = gx;
                bestY = gy;
              }
            }
          }
          return { ...z, x: snapToGrid(bestX), y: snapToGrid(bestY) };
        })
      );
    } else if (fix.action === 'add') {
      // Add missing zone type from fix label
      const typeMap: Record<string, ZoneType> = {
        'fix-add-medical': 'medical',
        'fix-add-airlock': 'airlock',
        'fix-add-lifesupport': 'life-support',
        'fix-add-command': 'command',
        'fix-add-sleep': 'sleep',
      };
      const type = typeMap[fix.id];
      if (type) {
        // Find empty spot
        const cx = 200 + Math.random() * 300;
        const cy = 200 + Math.random() * 200;
        const newZone = createZone(type, snapToGrid(cx), snapToGrid(cy));
        setZones((prev) => [...prev, newZone]);
      }
    }
  }, []);

  const handleSave = () => {
    const existing = getStoredLayouts();
    const name = LAYOUT_NAMES[existing.length % LAYOUT_NAMES.length];
    const layout: StoredLayout = {
      id: `layout-${Date.now()}`,
      name,
      zones: JSON.parse(JSON.stringify(zones)),
      config: { ...config },
      score,
      conflictsCount: conflicts.length,
      createdAt: Date.now(),
    };
    const updated = storeLayout(layout);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    onGoCompare(updated);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const canvasEl = canvasRef.current?.querySelector('canvas');
      let imgData = '';
      if (canvasEl) {
        imgData = canvasEl.toDataURL('image/png');
      }
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] });
      pdf.setFillColor(4, 7, 13);
      pdf.rect(0, 0, 800, 600, 'F');

      pdf.setTextColor(34, 211, 238);
      pdf.setFontSize(20);
      pdf.text('HabitatOS - Design Report', 30, 35);

      pdf.setTextColor(148, 163, 184);
      pdf.setFontSize(10);
      pdf.text(`Mission: ${config.label}  |  Crew: ${config.crewSize}  |  Shape: ${config.shape}`, 30, 52);

      if (imgData) {
        pdf.addImage(imgData, 'PNG', 30, 65, 400, 300);
      }

      // Score
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.text(`Habitat Health Score: ${score}/100`, 460, 90);

      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184);
      const metricLines = [
        `Safety: ${metrics.safety}`,
        `Accessibility: ${metrics.accessibility}`,
        `Acoustic Comfort: ${metrics.acoustic}`,
        `Space Efficiency: ${metrics.efficiency}`,
        `Compliance: ${metrics.compliance}`,
      ];
      metricLines.forEach((m, i) => pdf.text(m, 460, 110 + i * 16));

      // Rules
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text('Safety Checklist', 460, 210);
      pdf.setFontSize(9);
      rules.forEach((r, i) => {
        const status = r.passed ? '[PASS]' : '[FAIL]';
        pdf.setTextColor(r.passed ? 34 : 239, r.passed ? 197 : 68, r.passed ? 94 : 68);
        pdf.text(`${status} ${r.label}`, 460, 228 + i * 14);
      });

      // Conflicts
      const conflictStart = 228 + rules.length * 14 + 12;
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text(`Conflicts (${conflicts.length})`, 30, conflictStart);
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      if (conflicts.length === 0) {
        pdf.text('No active conflicts detected.', 30, conflictStart + 16);
      } else {
        conflicts.slice(0, 5).forEach((c, i) => {
          pdf.text(`- ${c.labelA} <-> ${c.labelB}: ${c.reason}`, 30, conflictStart + 16 + i * 14);
        });
      }

      // Recommendations
      const recStart = conflictStart + 16 + Math.max(conflicts.length, 1) * 14 + 12;
      pdf.setTextColor(34, 211, 238);
      pdf.setFontSize(12);
      pdf.text('Recommendations', 30, recStart);
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      if (fixes.length === 0) {
        pdf.text('All checks passed. Habitat design is optimal.', 30, recStart + 16);
      } else {
        fixes.forEach((f, i) => {
          pdf.text(`- ${f.label}: ${f.detail}`, 30, recStart + 16 + i * 14);
        });
      }

      pdf.save(`HabitatOS-Report-${Date.now()}.pdf`);
    } catch (e) {
      console.error('Export failed', e);
    }
    setExporting(false);
  };

  const handleClear = () => {
    setZones([]);
    setSelectedId(null);
  };

  return (
    <div className="h-screen bg-navy-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-cyan/10 bg-navy-900/80 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <button onClick={onGoHome} className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-glow to-blue-600 flex items-center justify-center">
              <Satellite className="w-4 h-4 text-navy-950" />
            </div>
            <span className="text-sm font-bold text-white hidden sm:inline">HabitatOS</span>
          </button>
          <div className="h-5 w-px bg-slate-700/50" />
          <div className="text-xs text-slate-400">
            <span className="text-cyan-glow font-medium">{config.label}</span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span>Crew {config.crewSize}</span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="capitalize">{config.shape}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggles */}
          <ViewToggle active={showHeatmap} onClick={() => setShowHeatmap(!showHeatmap)} icon={Thermometer} label="Heatmap" tooltip="Toggle acoustic noise heatmap overlay" />
          <ViewToggle active={showEgress} onClick={() => setShowEgress(!showEgress)} icon={Route} label="Egress" tooltip="Toggle emergency egress route visualization" />

          <div className="h-5 w-px bg-slate-700/50 mx-1" />

          <Tooltip text="Save current layout to localStorage and compare" side="bottom">
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                savedFlash
                  ? 'border-status-ok bg-status-ok/15 text-status-ok'
                  : 'border-slate-700/50 bg-navy-800/60 text-slate-300 hover:border-cyan-glow/40'
              }`}
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </Tooltip>
          <Tooltip text="Download PDF report with layout, scores, and recommendations" side="bottom">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 bg-navy-800/60 text-xs font-medium text-slate-300 hover:border-cyan-glow/40 transition-all disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" /> {exporting ? 'Exporting...' : 'Export'}
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-52 shrink-0 border-r border-cyan/10 bg-navy-900/50 flex flex-col overflow-y-auto panel-scroll">
          <div className="p-3">
            <ZonePalette
              selectedTool={selectedTool}
              onSelectTool={setSelectedTool}
            />
          </div>
          <div className="mt-auto p-3 border-t border-cyan/10">
            <Tooltip text="Remove all zones from canvas" side="right">
              <button
                onClick={handleClear}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-navy-800/60 border border-slate-700/50 text-xs text-slate-400 hover:border-status-danger/40 hover:text-status-danger transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </button>
            </Tooltip>
          </div>
        </aside>

        {/* Center canvas */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 relative">
            {zones.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="text-center animate-fade-in">
                  <Crosshair className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Click a zone in the palette, then click the canvas to place it</p>
                  <p className="text-slate-600 text-xs mt-1">Or load the demo layout from the onboarding tip below</p>
                </div>
              </div>
            )}
            <HabitatCanvas
              zones={zones}
              setZones={setZones}
              conflicts={conflicts}
              showHeatmap={showHeatmap}
              showEgress={showEgress}
              shape={config.shape}
              selectedTool={selectedTool}
              onSelectTool={setSelectedTool}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              canvasRef={canvasRef}
            />

            {/* Onboarding hint */}
            {showOnboarding && zones.length > 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-slide-up">
                <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-3 max-w-md">
                  <Info className="w-4 h-4 text-cyan-glow shrink-0" />
                  <span className="text-xs text-slate-300 flex-1">
                    Drag zones to reposition · Click to select & resize · Watch the <span className="text-status-danger">red !</span> for conflicts
                  </span>
                  <button onClick={() => setShowOnboarding(false)} className="text-slate-500 hover:text-slate-300 text-xs">
                    Got it
                  </button>
                </div>
              </div>
            )}

            {/* Selected tool indicator */}
            {selectedTool && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 animate-fade-in">
                <div className="glass rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-glow" />
                  <span className="text-xs text-slate-200">Click canvas to place <span style={{ color: ZONE_MAP[selectedTool].color }}>{ZONE_MAP[selectedTool].label}</span></span>
                  <button onClick={() => setSelectedTool(null)} className="text-slate-500 hover:text-slate-300 ml-1 text-xs">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom status bar */}
          <div className="flex items-center justify-between px-4 py-1.5 border-t border-cyan/10 bg-navy-900/60 text-[10px] font-mono text-slate-500">
            <div className="flex items-center gap-4">
              <span>{zones.length} zones</span>
              <span className={conflicts.length > 0 ? 'text-status-warn' : 'text-status-ok'}>
                {conflicts.length} conflicts
              </span>
              {showHeatmap && <span className="text-cyan-glow">HEATMAP ON</span>}
              {showEgress && <span className="text-cyan-glow">EGRESS ON</span>}
            </div>
            <span>Grid: 20px · Canvas: {CANVAS_W}×{CANVAS_H}</span>
          </div>
        </main>

        {/* Right analysis panel */}
        <aside className="w-72 shrink-0 border-l border-cyan/10 bg-navy-900/50">
          <AnalysisPanel
            score={score}
            prevScore={prevScore}
            metrics={metrics}
            rules={rules}
            fixes={fixes}
            conflicts={conflicts}
            onApplyFix={handleApplyFix}
          />
        </aside>
      </div>
    </div>
  );
}

function ViewToggle({ active, onClick, icon: Icon, label, tooltip }: {
  active: boolean; onClick: () => void; icon: typeof Grid3x3; label: string; tooltip: string;
}) {
  return (
    <Tooltip text={tooltip} side="bottom">
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
          active
            ? 'border-cyan-glow bg-cyan-glow/10 text-cyan-glow'
            : 'border-slate-700/50 bg-navy-800/60 text-slate-400 hover:text-white hover:border-slate-600'
        }`}
      >
        <Icon className="w-3.5 h-3.5" /> {label}
      </button>
    </Tooltip>
  );
}

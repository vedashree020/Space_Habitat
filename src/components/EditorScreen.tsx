import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Satellite, Save, FileDown, FileJson, Thermometer, Route, Grid3x3,
  Trash2, Info, Sparkles, Crosshair,
} from 'lucide-react';
import type { PlacedZone, MissionConfig, Conflict, ZoneType, EgressPath } from '../types';
import { CANVAS_W, CANVAS_H, ZONE_MAP, PATH_GRID_SIZE } from '../data';
import {
  detectConflicts, calcMetrics, calcScore, checkRules, generateSmartFixes,
  snapToGrid, computeEgressPaths, findBestRelocation, findFreeSpot,
  getScoreMethodology,
} from '../analysis';
import { createZone, storeLayout, type StoredLayout } from '../storage';
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
  const [highlightedZoneIds, setHighlightedZoneIds] = useState<Set<string>>(new Set());
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Conflicts via adjacency matrix
  const conflicts: Conflict[] = useMemo(() => detectConflicts(zones), [zones]);

  // A* egress paths — recomputed when zones or egress toggle change
  const egressPaths: EgressPath[] = useMemo(() => {
    if (!showEgress) return [];
    return computeEgressPaths(zones, CANVAS_W, CANVAS_H, PATH_GRID_SIZE);
  }, [zones, showEgress]);

  // Metrics from actual state
  const metrics = useMemo(() => calcMetrics(zones, config, conflicts, egressPaths), [zones, config, conflicts, egressPaths]);
  const score = useMemo(() => calcScore(metrics), [metrics]);
  const methodology = useMemo(() => getScoreMethodology(metrics), [metrics]);

  const prevScoreRef = useRef(score);
  const [prevScore, setPrevScore] = useState(score);

  // Dynamic rules based on config + actual state
  const rules = useMemo(() => checkRules(zones, config, conflicts, egressPaths), [zones, config, conflicts, egressPaths]);
  const fixes = useMemo(() => generateSmartFixes(zones, config, conflicts), [zones, config, conflicts]);

  useEffect(() => {
    setPrevScore(prevScoreRef.current);
    prevScoreRef.current = score;
  }, [score]);

  // Click conflict → highlight affected zones
  const handleConflictClick = useCallback((conflict: Conflict) => {
    setSelectedConflict(conflict);
    setHighlightedZoneIds(new Set([conflict.zoneA, conflict.zoneB]));
  }, []);

  // Click empty canvas → clear highlight
  const handleCanvasClick = useCallback(() => {
    setHighlightedZoneIds(new Set());
    setSelectedConflict(null);
  }, []);

  const handleApplyFix = useCallback((fix: typeof fixes[0]) => {
    if (fix.action === 'move' && fix.zoneId) {
      setZones((prev) => {
        const zone = prev.find((z) => z.id === fix.zoneId);
        if (!zone) return prev;
        const best = findBestRelocation(zone, prev, CANVAS_W, CANVAS_H);
        return prev.map((z) => (z.id === fix.zoneId ? { ...z, x: best.x, y: best.y } : z));
      });
    } else if (fix.action === 'add' && fix.targetType) {
      setZones((prev) => {
        const spot = findFreeSpot(fix.targetType!, prev, CANVAS_W, CANVAS_H);
        const newZone = createZone(fix.targetType!, spot.x, spot.y);
        return [...prev, newZone];
      });
    }
    // Clear highlight after applying fix
    setHighlightedZoneIds(new Set());
    setSelectedConflict(null);
  }, []);

  const handleSave = async () => {
    const existing = await import('../storage').then((m) => m.getStoredLayouts());
    const name = LAYOUT_NAMES[existing.length % LAYOUT_NAMES.length];
    const layout: StoredLayout = {
      id: `layout-${Date.now()}`,
      name,
      zones: JSON.parse(JSON.stringify(zones)),
      config: { ...config },
      score,
      metrics: { ...metrics },
      conflictsCount: conflicts.length,
      createdAt: Date.now(),
    };
    const updated = await storeLayout(layout);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    onGoCompare(updated);
  };

  const handleExportPDF = async () => {
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
      pdf.text(`Mission: ${config.label}  |  Crew: ${config.crewSize}  |  Duration: ${config.durationDays}d  |  Shape: ${config.shape}`, 30, 52);
      pdf.text(`Habitat: ${config.dimensions.w/10}m x ${config.dimensions.h/10}m  |  Zones: ${zones.length}  |  Conflicts: ${conflicts.length}`, 30, 66);

      if (imgData) {
        pdf.addImage(imgData, 'PNG', 30, 80, 380, 285);
      }

      // Score + metrics
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.text(`Habitat Health Score: ${score}/100`, 440, 95);

      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184);
      const metricLines = [
        `Safety: ${metrics.safety}/100  (weight: 30%)`,
        `Accessibility: ${metrics.accessibility}/100  (weight: 20%)`,
        `Acoustic Comfort: ${metrics.acoustic}/100  (weight: 20%)`,
        `Space Efficiency: ${metrics.efficiency}/100  (weight: 15%)`,
        `Compliance: ${metrics.compliance}/100  (weight: 15%)`,
      ];
      metricLines.forEach((m, i) => pdf.text(m, 440, 115 + i * 14));

      // Scoring methodology
      pdf.setTextColor(34, 211, 238);
      pdf.setFontSize(9);
      pdf.text('Score = weighted sum of 5 sub-metrics (computed from actual layout state)', 440, 195);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Simplified engineering assumptions — not NASA-certified', 440, 207);

      // Rules checklist with pass/warn/fail
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text('Safety Checklist', 440, 225);
      pdf.setFontSize(8);
      rules.forEach((r, i) => {
        const tag = r.status === 'pass' ? '[PASS]' : r.status === 'warn' ? '[WARN]' : '[FAIL]';
        const color = r.status === 'pass' ? [34, 197, 94] : r.status === 'warn' ? [245, 158, 11] : [239, 68, 68];
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(`${tag} ${r.label}`, 440, 240 + i * 12);
      });

      // Conflicts
      const conflictStart = 80 + 300;
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text(`Conflicts (${conflicts.length}) — adjacency matrix detection`, 30, conflictStart);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      if (conflicts.length === 0) {
        pdf.text('No active conflicts detected.', 30, conflictStart + 14);
      } else {
        conflicts.slice(0, 6).forEach((c, i) => {
          pdf.text(`- [${c.severity}] ${c.labelA} <-> ${c.labelB}: ${c.reason} (dist: ${Math.round(c.distance)}px)`, 30, conflictStart + 14 + i * 12);
        });
      }

      // Egress info
      const egressStart = conflictStart + 14 + Math.max(Math.min(conflicts.length, 6), 1) * 12 + 10;
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text('Egress Analysis (A* pathfinding)', 30, egressStart);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      const routed = egressPaths.filter(p => p.hasExit).length;
      const noExit = egressPaths.filter(p => !p.hasExit).length;
      pdf.text(`${routed} zones with A* routes to airlock, ${noExit} zones without exit route`, 30, egressStart + 14);

      // Recommendations
      const recStart = egressStart + 14 + 16;
      pdf.setTextColor(34, 211, 238);
      pdf.setFontSize(12);
      pdf.text('Smart Fix Recommendations', 30, recStart);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      if (fixes.length === 0) {
        pdf.text('All checks passed. Habitat design is optimal.', 30, recStart + 14);
      } else {
        fixes.forEach((f, i) => {
          pdf.text(`- ${f.label}: ${f.detail}`, 30, recStart + 14 + i * 12);
        });
      }

      pdf.save(`HabitatOS-Report-${Date.now()}.pdf`);
    } catch (e) {
      console.error('PDF export failed', e);
    }
    setExporting(false);
  };

  const handleExportJSON = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      application: 'HabitatOS',
      version: '2.0',
      disclaimer: 'Simplified engineering assumptions for prototype — not NASA-certified',
      mission: {
        type: config.type,
        label: config.label,
        crewSize: config.crewSize,
        durationDays: config.durationDays,
        shape: config.shape,
        dimensions: { width_m: config.dimensions.w / 10, height_m: config.dimensions.h / 10 },
      },
      layout: {
        zones: zones.map((z) => ({
          id: z.id,
          type: z.type,
          label: z.label,
          position: { x: z.x, y: z.y },
          size: { w: z.width, h: z.height },
          noiseLevel: z.noiseLevel,
        })),
      },
      analysis: {
        healthScore: score,
        metrics: {
          safety: { value: metrics.safety, weight: methodology.weights.safety, formula: methodology.factors[0].formula },
          accessibility: { value: metrics.accessibility, weight: methodology.weights.accessibility, formula: methodology.factors[1].formula },
          acoustic: { value: metrics.acoustic, weight: methodology.weights.acoustic, formula: methodology.factors[2].formula },
          efficiency: { value: metrics.efficiency, weight: methodology.weights.efficiency, formula: methodology.factors[3].formula },
          compliance: { value: metrics.compliance, weight: methodology.weights.compliance, formula: methodology.factors[4].formula },
        },
        conflicts: conflicts.map((c) => ({
          zoneA: c.labelA,
          zoneB: c.labelB,
          severity: c.severity,
          reason: c.reason,
          distance: Math.round(c.distance),
        })),
        egress: egressPaths.map((p) => {
          const z = zones.find((zz) => zz.id === p.zoneId);
          const al = zones.find((zz) => zz.id === p.airlockId);
          return {
            zone: z?.label || 'unknown',
            airlock: al?.label || 'none',
            hasExit: p.hasExit,
            pathLength: p.pathLength,
            waypoints: p.waypoints.length,
          };
        }),
        rules: rules.map((r) => ({ label: r.label, status: r.status, detail: r.detail })),
        smartFixes: fixes.map((f) => ({ label: f.label, detail: f.detail, action: f.action })),
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HabitatOS-Report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setZones([]);
    setSelectedId(null);
    setHighlightedZoneIds(new Set());
    setSelectedConflict(null);
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
            <span>{config.durationDays}d</span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="capitalize">{config.shape}</span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span>{config.dimensions.w/10}×{config.dimensions.h/10}m</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ViewToggle active={showHeatmap} onClick={() => setShowHeatmap(!showHeatmap)} icon={Thermometer} label="Heatmap" tooltip="Toggle acoustic noise heatmap (inverse-distance decay model)" />
          <ViewToggle active={showEgress} onClick={() => setShowEgress(!showEgress)} icon={Route} label="Egress" tooltip="Toggle A* emergency egress routes to nearest airlock" />

          <div className="h-5 w-px bg-slate-700/50 mx-1" />

          <Tooltip text="Save layout to IndexedDB and compare" side="bottom">
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

          <Tooltip text="Export PDF report with layout, scores, and recommendations" side="bottom">
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 bg-navy-800/60 text-xs font-medium text-slate-300 hover:border-cyan-glow/40 transition-all disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" /> {exporting ? 'Exporting...' : 'PDF'}
            </button>
          </Tooltip>

          <Tooltip text="Export JSON report with full layout state and analysis data" side="bottom">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 bg-navy-800/60 text-xs font-medium text-slate-300 hover:border-cyan-glow/40 transition-all"
            >
              <FileJson className="w-3.5 h-3.5" /> JSON
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
                </div>
              </div>
            )}
            <div onClick={handleCanvasClick}>
              <HabitatCanvas
                zones={zones}
                setZones={setZones}
                conflicts={conflicts}
                egressPaths={egressPaths}
                showHeatmap={showHeatmap}
                showEgress={showEgress}
                shape={config.shape}
                selectedTool={selectedTool}
                onSelectTool={setSelectedTool}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                canvasRef={canvasRef}
                highlightedZoneIds={highlightedZoneIds}
                onConflictClick={handleConflictClick}
              />
            </div>

            {/* Conflict detail popup */}
            {selectedConflict && (
              <div className="absolute top-4 right-4 z-10 animate-slide-up">
                <div className="glass rounded-xl p-3 max-w-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${selectedConflict.severity === 'high' ? 'bg-status-danger' : 'bg-status-warn'}`} />
                    <span className="text-xs font-semibold text-white">Conflict Detail</span>
                    <button onClick={() => { setSelectedConflict(null); setHighlightedZoneIds(new Set()); }} className="ml-auto text-slate-500 hover:text-slate-300 text-xs">✕</button>
                  </div>
                  <div className="text-[11px] text-slate-300 mb-1">{selectedConflict.labelA} ↔ {selectedConflict.labelB}</div>
                  <div className="text-[10px] text-slate-400 mb-2">{selectedConflict.reason}</div>
                  <div className="text-[10px] text-slate-500 font-mono">Severity: {selectedConflict.severity} · Distance: {Math.round(selectedConflict.distance)}px</div>
                  <div className="text-[10px] text-cyan-glow/60 font-mono mt-1">Adjacency rule: {selectedConflict.ruleId}</div>
                </div>
              </div>
            )}

            {/* Onboarding hint */}
            {showOnboarding && zones.length > 0 && !selectedConflict && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-slide-up">
                <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-3 max-w-lg">
                  <Info className="w-4 h-4 text-cyan-glow shrink-0" />
                  <span className="text-xs text-slate-300 flex-1">
                    Drag zones · Click <span className="text-status-danger">red !</span> to highlight conflict · Enable <span className="text-cyan-glow">Egress</span> for A* routes · <span className="text-cyan-glow">Heatmap</span> for acoustic model
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
              {showEgress && (
                <span className="text-cyan-glow">
                  {egressPaths.filter(p => p.hasExit).length}/{egressPaths.length} A* routes
                </span>
              )}
              {showHeatmap && <span className="text-cyan-glow">HEATMAP (acoustic decay)</span>}
              {highlightedZoneIds.size > 0 && <span className="text-cyan-glow">{highlightedZoneIds.size} highlighted</span>}
            </div>
            <span>Grid: {GRID_SIZE}px · Pathfinding: A* · Conflict: adjacency matrix</span>
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
            methodology={methodology}
            onApplyFix={handleApplyFix}
            onConflictClick={handleConflictClick}
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

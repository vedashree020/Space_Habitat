import type { PlacedZone, Conflict, ScoreMetrics, RuleCheck, SmartFix, MissionConfig } from './types';
import { CONFLICT_RULES, GRID_SIZE } from './data';

function dist(a: PlacedZone, b: PlacedZone): number {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

export function detectConflicts(zones: PlacedZone[]): Conflict[] {
  const conflicts: Conflict[] = [];
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const za = zones[i];
      const zb = zones[j];
      const d = dist(za, zb);
      for (const rule of CONFLICT_RULES) {
        if (
          (za.type === rule.a && zb.type === rule.b) ||
          (za.type === rule.b && zb.type === rule.a)
        ) {
          if (d < rule.maxDist) {
            conflicts.push({
              zoneA: za.id,
              zoneB: zb.id,
              labelA: za.label,
              labelB: zb.label,
              midX: (za.x + za.width / 2 + zb.x + zb.width / 2) / 2,
              midY: (za.y + za.height / 2 + zb.y + zb.height / 2) / 2,
              reason: rule.reason,
              severity: rule.severity,
            });
          }
        }
      }
    }
  }
  return conflicts;
}

export function calcMetrics(zones: PlacedZone[], config: MissionConfig, conflicts: Conflict[]): ScoreMetrics {
  const types = new Set(zones.map((z) => z.type));
  const hasAirlock = types.has('airlock');
  const hasMedical = types.has('medical');
  const hasCommand = types.has('command');
  const hasLifeSupport = types.has('life-support');
  const hasSleep = types.has('sleep');

  // Safety: airlock present, no exit-less zones, low conflict count
  const noExitCount = hasAirlock ? countNoExit(zones) : zones.length;
  const safety = Math.max(0, Math.min(100, 100 - conflicts.filter((c) => c.severity === 'high').length * 15 - noExitCount * 20));

  // Accessibility: ratio of zones with an airlock path, plus presence of command
  const accessibility = hasAirlock
    ? Math.max(0, Math.min(100, 100 - noExitCount * 15 + (hasCommand ? 5 : -10)))
    : 20;

  // Acoustic: average noise with penalty for sleep near loud zones
  const sleepZones = zones.filter((z) => z.type === 'sleep');
  let acoustic = 70;
  if (sleepZones.length === 0) acoustic = 40;
  for (const s of sleepZones) {
    for (const z of zones) {
      if (z.id === s.id) continue;
      const d = dist(s, z);
      if (d < 200) {
        acoustic -= (z.noiseLevel - 30) * 0.15;
      }
    }
  }
  acoustic = Math.max(0, Math.min(100, acoustic));

  // Space efficiency: how well packed (not too sparse, not overlapping)
  const totalArea = zones.reduce((sum, z) => sum + z.width * z.height, 0);
  const canvasArea = 720 * 540;
  const ratio = totalArea / canvasArea;
  const efficiency = Math.max(0, Math.min(100, 100 - Math.abs(ratio - 0.35) * 120));

  // Compliance: required zones present
  const required: boolean[] = [hasSleep, hasMedical, hasLifeSupport, hasCommand];
  const compliance = Math.round((required.filter(Boolean).length / required.length) * 100);

  return {
    safety: Math.round(safety),
    accessibility: Math.round(accessibility),
    acoustic: Math.round(acoustic),
    efficiency: Math.round(efficiency),
    compliance,
  };
}

export function calcScore(metrics: ScoreMetrics): number {
  const w = { safety: 0.3, accessibility: 0.2, acoustic: 0.2, efficiency: 0.15, compliance: 0.15 };
  return Math.round(
    metrics.safety * w.safety +
      metrics.accessibility * w.accessibility +
      metrics.acoustic * w.acoustic +
      metrics.efficiency * w.efficiency +
      metrics.compliance * w.compliance
  );
}

function countNoExit(zones: PlacedZone[]): number {
  const airlocks = zones.filter((z) => z.type === 'airlock');
  if (airlocks.length === 0) return zones.length;
  let count = 0;
  for (const z of zones) {
    if (z.type === 'airlock') continue;
    const minD = Math.min(...airlocks.map((a) => dist(z, a)));
    if (minD > 400) count++;
  }
  return count;
}

export function getNoExitZones(zones: PlacedZone[]): PlacedZone[] {
  const airlocks = zones.filter((z) => z.type === 'airlock');
  if (airlocks.length === 0) return zones.filter((z) => z.type !== 'airlock');
  return zones.filter((z) => {
    if (z.type === 'airlock') return false;
    const minD = Math.min(...airlocks.map((a) => dist(z, a)));
    return minD > 400;
  });
}

export function getNearestAirlock(zone: PlacedZone, zones: PlacedZone[]): PlacedZone | null {
  const airlocks = zones.filter((z) => z.type === 'airlock');
  if (airlocks.length === 0) return null;
  let best = airlocks[0];
  let bestD = Infinity;
  for (const a of airlocks) {
    const d = dist(zone, a);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

export function checkRules(zones: PlacedZone[], config: MissionConfig, conflicts: Conflict[]): RuleCheck[] {
  const types = new Set(zones.map((z) => z.type));
  const sleepCount = zones.filter((z) => z.type === 'sleep').length;
  const airlockCount = zones.filter((z) => z.type === 'airlock').length;
  const noExit = getNoExitZones(zones);
  const highConflicts = conflicts.filter((c) => c.severity === 'high');

  return [
    {
      id: 'sleep-per-crew',
      label: `Sleep zone for every crew member (${config.crewSize})`,
      passed: sleepCount >= Math.ceil(config.crewSize / 2),
      detail: `${sleepCount} placed, need ${Math.ceil(config.crewSize / 2)}`,
    },
    {
      id: 'medical-present',
      label: 'Medical zone present',
      passed: types.has('medical'),
      detail: types.has('medical') ? 'Medical zone deployed' : 'No medical zone',
    },
    {
      id: 'airlock-present',
      label: 'At least one Airlock',
      passed: airlockCount >= 1,
      detail: `${airlockCount} airlock(s)`,
    },
    {
      id: 'life-support',
      label: 'Life Support zone present',
      passed: types.has('life-support'),
      detail: types.has('life-support') ? 'Life support active' : 'No life support',
    },
    {
      id: 'command-present',
      label: 'Command zone present',
      passed: types.has('command'),
      detail: types.has('command') ? 'Command center operational' : 'No command zone',
    },
    {
      id: 'no-exit',
      label: 'All zones have egress routes',
      passed: noExit.length === 0,
      detail: noExit.length === 0 ? 'All zones reachable' : `${noExit.length} zone(s) without exit`,
    },
    {
      id: 'no-high-conflicts',
      label: 'No high-severity conflicts',
      passed: highConflicts.length === 0,
      detail: highConflicts.length === 0 ? 'No critical conflicts' : `${highConflicts.length} critical conflict(s)`,
    },
  ];
}

export function generateSmartFixes(zones: PlacedZone[], config: MissionConfig, conflicts: Conflict[], _rules: RuleCheck[]): SmartFix[] {
  const fixes: SmartFix[] = [];
  const types = new Set(zones.map((z) => z.type));

  // Move conflicts apart
  for (const c of conflicts) {
    if (c.severity === 'high') {
      fixes.push({
        id: `fix-conflict-${c.zoneA}-${c.zoneB}`,
        label: `Move ${c.labelA} away from ${c.labelB}`,
        zoneId: c.zoneA,
        action: 'move',
        detail: c.reason,
      });
    }
  }

  // Add missing zones
  if (!types.has('medical')) {
    fixes.push({ id: 'fix-add-medical', label: 'Add Medical zone', zoneId: '', action: 'add', detail: 'Medical zone required for crew safety' });
  }
  if (!types.has('airlock')) {
    fixes.push({ id: 'fix-add-airlock', label: 'Add Airlock zone', zoneId: '', action: 'add', detail: 'At least one egress point required' });
  }
  if (!types.has('life-support')) {
    fixes.push({ id: 'fix-add-lifesupport', label: 'Add Life Support zone', zoneId: '', action: 'add', detail: 'Life support is mission-critical' });
  }
  if (!types.has('command')) {
    fixes.push({ id: 'fix-add-command', label: 'Add Command zone', zoneId: '', action: 'add', detail: 'Command center for operations' });
  }

  const sleepCount = zones.filter((z) => z.type === 'sleep').length;
  const needed = Math.ceil(config.crewSize / 2);
  if (sleepCount < needed) {
    fixes.push({ id: 'fix-add-sleep', label: `Add ${needed - sleepCount} more Sleep zone(s)`, zoneId: '', action: 'add', detail: `Need ${needed} for ${config.crewSize} crew` });
  }

  return fixes.slice(0, 6);
}

export function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

export function zoneArea(z: PlacedZone): number {
  return (z.width / GRID_SIZE) * (z.height / GRID_SIZE);
}

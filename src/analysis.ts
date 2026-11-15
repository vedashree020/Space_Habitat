import type {
  PlacedZone, Conflict, ScoreMetrics, RuleCheck, SmartFix, MissionConfig,
  EgressPath, ScoreMethodology, HabitatShape,
} from './types';
import { CONFLICT_RULES, GRID_SIZE, getConflictRule, ALL_ZONE_TYPES } from './data';

/* ─────────────────────────  Geometry helpers  ───────────────────────── */

function zoneCenter(z: PlacedZone): { x: number; y: number } {
  return { x: z.x + z.width / 2, y: z.y + z.height / 2 };
}

function dist(a: PlacedZone, b: PlacedZone): number {
  const ac = zoneCenter(a);
  const bc = zoneCenter(b);
  return Math.sqrt((ac.x - bc.x) ** 2 + (ac.y - bc.y) ** 2);
}

/** Rectangle intersection test (AABB) */
export function rectsOverlap(a: PlacedZone, b: PlacedZone): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

/* ─────────────────────  Adjacency-matrix conflict detection  ────────── */

/**
 * Detect zone conflicts using the graph adjacency matrix.
 * For each pair of zones, checks if their types have a conflict rule,
 * then evaluates proximity (distance between centers < rule.maxDist) and overlap.
 *
 * Simplified assumption: "close" = center-to-center distance < maxDist OR bounding boxes overlap.
 */
export function detectConflicts(zones: PlacedZone[]): Conflict[] {
  const conflicts: Conflict[] = [];
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const za = zones[i];
      const zb = zones[j];
      const rule = getConflictRule(za.type, zb.type);
      if (!rule) continue;

      const d = dist(za, zb);
      const overlap = rectsOverlap(za, zb);

      // Conflict if zones overlap or are within the rule's max distance
      if (overlap || d < rule.maxDist) {
        const ac = zoneCenter(za);
        const bc = zoneCenter(zb);
        const effectiveDist = overlap ? 0 : d;
        conflicts.push({
          zoneA: za.id,
          zoneB: zb.id,
          labelA: za.label,
          labelB: zb.label,
          midX: (ac.x + bc.x) / 2,
          midY: (ac.y + bc.y) / 2,
          reason: rule.reason,
          severity: rule.severity,
          distance: effectiveDist,
          ruleId: rule.a < rule.b ? `${rule.a}:${rule.b}` : `${rule.b}:${rule.a}`,
        });
      }
    }
  }
  return conflicts;
}

/** Get all zone IDs involved in any conflict */
export function getConflictingZoneIds(conflicts: Conflict[]): Set<string> {
  const ids = new Set<string>();
  for (const c of conflicts) {
    ids.add(c.zoneA);
    ids.add(c.zoneB);
  }
  return ids;
}

/* ─────────────────────────  Acoustic decay model  ──────────────────── */

/**
 * Acoustic decay model (simplified inverse-square-law approximation).
 *
 * Assumptions:
 * - Noise attenuates with distance using an inverse-distance decay factor
 * - Each zone acts as a point source at its center with its base noiseLevel
 * - The effective noise at any point = sum of all sources attenuated by distance
 * - Decay coefficient models absorption in a pressurized module (alpha ~ 0.005 per pixel)
 *
 * L(point) = L_source - 20 * log10(1 + d / d_ref)  (simplified propagation loss)
 */
const DECAY_REF = 50; // reference distance in pixels
const ABSORPTION = 0.8; // additional absorption factor

export function noiseAtPoint(x: number, y: number, zones: PlacedZone[]): number {
  let total = 0;
  for (const z of zones) {
    const c = zoneCenter(z);
    const dx = x - c.x;
    const dy = y - c.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) {
      total += z.noiseLevel;
      continue;
    }
    // Inverse-distance propagation loss in dB (simplified)
    const loss = 20 * Math.log10(1 + d / DECAY_REF);
    const effective = z.noiseLevel - loss * ABSORPTION;
    if (effective > 0) total += effective;
  }
  // Cap at reasonable max
  return Math.min(120, Math.round(total));
}

/**
 * Compute the effective noise level at each zone (noise received from all other zones).
 * Updates when zones are moved because distance changes.
 */
export function effectiveNoiseAtZone(zone: PlacedZone, allZones: PlacedZone[]): number {
  const c = zoneCenter(zone);
  let received = 0;
  for (const other of allZones) {
    if (other.id === zone.id) continue;
    const oc = zoneCenter(other);
    const d = Math.sqrt((c.x - oc.x) ** 2 + (c.y - oc.y) ** 2);
    if (d < 1) {
      received += other.noiseLevel;
      continue;
    }
    const loss = 20 * Math.log10(1 + d / DECAY_REF);
    const effective = other.noiseLevel - loss * ABSORPTION;
    if (effective > 0) received += effective;
  }
  return Math.min(120, Math.round(received));
}

/**
 * Generate a grid of noise values for heatmap rendering.
 * Samples the canvas at PATH_GRID_SIZE intervals.
 */
export function computeNoiseGrid(zones: PlacedZone[], width: number, height: number, cellSize: number): { x: number; y: number; noise: number }[] {
  const grid: { x: number; y: number; noise: number }[] = [];
  for (let x = 0; x < width; x += cellSize) {
    for (let y = 0; y < height; y += cellSize) {
      const noise = noiseAtPoint(x + cellSize / 2, y + cellSize / 2, zones);
      if (noise > 5) {
        grid.push({ x: x + cellSize / 2, y: y + cellSize / 2, noise });
      }
    }
  }
  return grid;
}

/* ─────────────────────────  A* Pathfinding  ────────────────────────── */

interface AStarNode {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: AStarNode | null;
}

/**
 * Build a walkability grid for A*.
 * Cells occupied by zone bounding boxes are obstacles.
 * Airlock cells are walkable destinations (not obstacles).
 *
 * Simplified assumption: zones are solid obstacles; paths route around them.
 */
function buildWalkableGrid(zones: PlacedZone[], width: number, height: number, cellSize: number, excludeZoneId?: string): boolean[][] {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const grid: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(true));

  for (const z of zones) {
    if (z.id === excludeZoneId) continue;
    // Don't block the airlock zones — they are destinations
    if (z.type === 'airlock') continue;
    const c0 = Math.floor(z.x / cellSize);
    const r0 = Math.floor(z.y / cellSize);
    const c1 = Math.ceil((z.x + z.width) / cellSize);
    const r1 = Math.ceil((z.y + z.height) / cellSize);
    for (let r = Math.max(0, r0); r < Math.min(rows, r1); r++) {
      for (let c = Math.max(0, c0); c < Math.min(cols, c1); c++) {
        grid[r][c] = false;
      }
    }
  }
  return grid;
}

/**
 * A* pathfinding on a 2D grid.
 * Returns array of waypoints (in canvas coordinates) from start to goal, or null if no path.
 *
 * Simplified assumption: 4-directional movement (Manhattan), uniform cost.
 * The heuristic is Manhattan distance, admissible for 4-connected grids.
 */
export function findPath(
  start: { x: number; y: number },
  goal: { x: number; y: number },
  zones: PlacedZone[],
  width: number,
  height: number,
  cellSize: number,
  excludeZoneId?: string,
): { x: number; y: number }[] | null {
  const grid = buildWalkableGrid(zones, width, height, cellSize, excludeZoneId);
  const cols = grid[0].length;
  const rows = grid.length;

  const sc = Math.floor(start.x / cellSize);
  const sr = Math.floor(start.y / cellSize);
  const gc = Math.floor(goal.x / cellSize);
  const gr = Math.floor(goal.y / cellSize);

  // Clamp to grid bounds
  const scClamped = Math.max(0, Math.min(cols - 1, sc));
  const srClamped = Math.max(0, Math.min(rows - 1, sr));
  const gcClamped = Math.max(0, Math.min(cols - 1, gc));
  const grClamped = Math.max(0, Math.min(rows - 1, gr));

  // If start cell is blocked, find nearest walkable cell
  let actualStartR = srClamped;
  let actualStartC = scClamped;
  if (!grid[srClamped][scClamped]) {
    const open = findNearestWalkable(grid, srClamped, scClamped, rows, cols);
    if (!open) return null;
    actualStartR = open.r;
    actualStartC = open.c;
  }

  // If goal cell is blocked (e.g. inside an airlock zone), find nearest walkable
  let actualGoalR = grClamped;
  let actualGoalC = gcClamped;
  if (!grid[grClamped][gcClamped]) {
    const open = findNearestWalkable(grid, grClamped, gcClamped, rows, cols);
    if (!open) return null;
    actualGoalR = open.r;
    actualGoalC = open.c;
  }

  const openList: AStarNode[] = [];
  const closedSet = new Set<string>();
  const startNode: AStarNode = {
    x: actualStartC, y: actualStartR, g: 0,
    h: Math.abs(actualStartC - actualGoalC) + Math.abs(actualStartR - actualGoalR),
    f: 0, parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openList.push(startNode);

  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  let iterations = 0;
  const maxIter = cols * rows;

  while (openList.length > 0 && iterations < maxIter) {
    iterations++;
    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[bestIdx].f) bestIdx = i;
    }
    const current = openList.splice(bestIdx, 1)[0];
    const key = `${current.x},${current.y}`;
    closedSet.add(key);

    if (current.x === actualGoalC && current.y === actualGoalR) {
      // Reconstruct path
      const path: { x: number; y: number }[] = [];
      let node: AStarNode | null = current;
      while (node) {
        path.unshift({ x: node.x * cellSize + cellSize / 2, y: node.y * cellSize + cellSize / 2 });
        node = node.parent;
      }
      return path;
    }

    for (const [dc, dr] of dirs) {
      const nc = current.x + dc;
      const nr = current.y + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      if (!grid[nr][nc]) continue;
      const nkey = `${nc},${nr}`;
      if (closedSet.has(nkey)) continue;

      const g = current.g + 1;
      const h = Math.abs(nc - actualGoalC) + Math.abs(nr - actualGoalR);
      const f = g + h;

      const existing = openList.find((n) => n.x === nc && n.y === nr);
      if (existing && existing.f <= f) continue;

      openList.push({ x: nc, y: nr, g, h, f, parent: current });
    }
  }
  return null;
}

function findNearestWalkable(grid: boolean[][], r: number, c: number, rows: number, cols: number): { r: number; c: number } | null {
  for (let radius = 1; radius < Math.max(rows, cols); radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc]) {
          return { r: nr, c: nc };
        }
      }
    }
  }
  return null;
}

/**
 * Compute egress paths for all non-airlock zones using A* to the nearest reachable airlock.
 */
export function computeEgressPaths(
  zones: PlacedZone[],
  width: number,
  height: number,
  cellSize: number,
): EgressPath[] {
  const airlocks = zones.filter((z) => z.type === 'airlock');
  const results: EgressPath[] = [];

  for (const zone of zones) {
    if (zone.type === 'airlock') continue;

    if (airlocks.length === 0) {
      results.push({
        zoneId: zone.id,
        airlockId: '',
        waypoints: [],
        pathLength: 0,
        hasExit: false,
      });
      continue;
    }

    const start = zoneCenter(zone);
    let bestPath: { x: number; y: number }[] | null = null;
    let bestAirlock: PlacedZone | null = null;
    let bestLen = Infinity;

    for (const al of airlocks) {
      const goal = zoneCenter(al);
      const path = findPath(start, goal, zones, width, height, cellSize, zone.id);
      if (path && path.length > 0) {
        const len = pathLength(path);
        if (len < bestLen) {
          bestLen = len;
          bestPath = path;
          bestAirlock = al;
        }
      }
    }

    if (bestPath && bestAirlock) {
      results.push({
        zoneId: zone.id,
        airlockId: bestAirlock.id,
        waypoints: bestPath,
        pathLength: Math.round(bestLen),
        hasExit: true,
      });
    } else {
      results.push({
        zoneId: zone.id,
        airlockId: '',
        waypoints: [],
        pathLength: 0,
        hasExit: false,
      });
    }
  }
  return results;
}

function pathLength(path: { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.sqrt(
      (path[i].x - path[i - 1].x) ** 2 + (path[i].y - path[i - 1].y) ** 2,
    );
  }
  return total;
}

/** Zones with no reachable airlock via A* */
export function getNoExitZoneIds(egressPaths: EgressPath[]): Set<string> {
  const ids = new Set<string>();
  for (const p of egressPaths) {
    if (!p.hasExit) ids.add(p.zoneId);
  }
  return ids;
}

/* ─────────────────────────  Scoring  ───────────────────────────────── */

const SCORE_WEIGHTS = { safety: 0.3, accessibility: 0.2, acoustic: 0.2, efficiency: 0.15, compliance: 0.15 };

/**
 * Compute 5 sub-metrics from actual habitat state.
 * All values derived from real zone positions, conflicts, and egress paths.
 */
export function calcMetrics(
  zones: PlacedZone[],
  config: MissionConfig,
  conflicts: Conflict[],
  egressPaths: EgressPath[],
): ScoreMetrics {
  const types = new Set(zones.map((z) => z.type));
  const hasAirlock = types.has('airlock');
  const hasCommand = types.has('command');
  const hasSleep = types.has('sleep');

  const highConflicts = conflicts.filter((c) => c.severity === 'high').length;
  const medConflicts = conflicts.filter((c) => c.severity === 'medium').length;
  const noExitCount = egressPaths.filter((p) => !p.hasExit).length;
  const totalPaths = egressPaths.length;
  const reachableRatio = totalPaths > 0 ? (totalPaths - noExitCount) / totalPaths : 0;

  // Safety: penalize high conflicts heavily, medium conflicts moderately, no-exit zones severely
  const safety = Math.max(0, Math.min(100,
    100 - highConflicts * 18 - medConflicts * 8 - noExitCount * 25,
  ));

  // Accessibility: ratio of zones with reachable egress + bonus for command presence
  const accessibility = Math.max(0, Math.min(100,
    Math.round(reachableRatio * 90 + (hasCommand ? 10 : 0)),
  ));

  // Acoustic comfort: based on effective noise at sleep zones
  // Lower received noise = higher score
  const sleepZones = zones.filter((z) => z.type === 'sleep');
  let acoustic: number;
  if (sleepZones.length === 0) {
    acoustic = 35; // no sleep zones = poor habitability
  } else {
    let totalReceived = 0;
    for (const s of sleepZones) {
      totalReceived += effectiveNoiseAtZone(s, zones);
    }
    const avgReceived = totalReceived / sleepZones.length;
    // Map: 0 dB received = 100, 60+ dB received = 20
    acoustic = Math.max(0, Math.min(100, Math.round(100 - avgReceived * 1.3)));
  }

  // Space efficiency: how well-packed without excessive overlap or sparse layout
  const totalZoneArea = zones.reduce((sum, z) => sum + z.width * z.height, 0);
  const canvasArea = config.dimensions.w * config.dimensions.h;
  const coverageRatio = totalZoneArea / canvasArea;
  // Ideal coverage ~0.30-0.45; penalize deviation
  const idealLow = 0.30, idealHigh = 0.45;
  let efficiency: number;
  if (coverageRatio >= idealLow && coverageRatio <= idealHigh) {
    efficiency = 95;
  } else if (coverageRatio < idealLow) {
    efficiency = Math.max(20, Math.round(95 - (idealLow - coverageRatio) * 200));
  } else {
    efficiency = Math.max(20, Math.round(95 - (coverageRatio - idealHigh) * 200));
  }
  // Penalize overlapping zones
  let overlapCount = 0;
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      if (rectsOverlap(zones[i], zones[j])) overlapCount++;
    }
  }
  efficiency = Math.max(0, efficiency - overlapCount * 10);

  // Compliance: percentage of required zone types present
  const requiredTypes: ZoneType[] = ['sleep', 'medical', 'life-support', 'command', 'airlock'];
  const present = requiredTypes.filter((t) => types.has(t)).length;
  const compliance = Math.round((present / requiredTypes.length) * 100);

  return {
    safety: Math.round(safety),
    accessibility: Math.round(accessibility),
    acoustic: Math.round(acoustic),
    efficiency: Math.round(efficiency),
    compliance,
  };
}

export function calcScore(metrics: ScoreMetrics): number {
  return Math.round(
    metrics.safety * SCORE_WEIGHTS.safety +
    metrics.accessibility * SCORE_WEIGHTS.accessibility +
    metrics.acoustic * SCORE_WEIGHTS.acoustic +
    metrics.efficiency * SCORE_WEIGHTS.efficiency +
    metrics.compliance * SCORE_WEIGHTS.compliance,
  );
}

export function getScoreMethodology(metrics: ScoreMetrics): ScoreMethodology {
  return {
    weights: { ...SCORE_WEIGHTS },
    factors: [
      { metric: 'Safety', formula: '100 - 18*highConflicts - 8*medConflicts - 25*noExitZones', value: metrics.safety },
      { metric: 'Accessibility', formula: '0.9 * reachableRatio + 10*(hasCommand)', value: metrics.accessibility },
      { metric: 'Acoustic', formula: '100 - 1.3 * avgNoiseAtSleepZones', value: metrics.acoustic },
      { metric: 'Efficiency', formula: '95 - deviationFromIdealCoverage*200 - 10*overlaps', value: metrics.efficiency },
      { metric: 'Compliance', formula: '(presentRequiredTypes / 5) * 100', value: metrics.compliance },
    ],
  };
}

/* ─────────────────────  Dynamic rule checklist  ────────────────────── */

/**
 * Dynamically generate safety rules based on actual habitat configuration and crew size.
 * Rules adapt: e.g. more crew = more sleep zones needed; longer missions need more zone types.
 */
export function checkRules(
  zones: PlacedZone[],
  config: MissionConfig,
  conflicts: Conflict[],
  egressPaths: EgressPath[],
): RuleCheck[] {
  const types = new Set(zones.map((z) => z.type));
  const sleepCount = zones.filter((z) => z.type === 'sleep').length;
  const airlockCount = zones.filter((z) => z.type === 'airlock').length;
  const noExitIds = getNoExitZoneIds(egressPaths);
  const highConflicts = conflicts.filter((c) => c.severity === 'high');
  const medConflicts = conflicts.filter((c) => c.severity === 'medium');
  const overlaps = countOverlaps(zones);

  // Required sleep zones: 1 per 2 crew (shared quarters assumption)
  const neededSleep = Math.ceil(config.crewSize / 2);
  // For missions > 90 days, require separate hygiene and galley
  const longMission = config.durationDays > 90;
  // Airlock requirement scales with crew
  const neededAirlocks = config.crewSize > 6 ? 2 : 1;

  const rules: RuleCheck[] = [
    {
      id: 'sleep-per-crew',
      label: `Sleep zones for ${config.crewSize} crew (need ${neededSleep})`,
      status: sleepCount >= neededSleep ? 'pass' : sleepCount === 0 ? 'fail' : 'warn',
      detail: `${sleepCount} placed, ${neededSleep} required (1 per 2 crew, shared quarters)`,
    },
    {
      id: 'medical-present',
      label: 'Medical zone present',
      status: types.has('medical') ? 'pass' : 'fail',
      detail: types.has('medical') ? 'Medical zone deployed' : 'No medical zone — required for crew safety',
    },
    {
      id: 'airlock-present',
      label: `Airlock zones (need ${neededAirlocks})`,
      status: airlockCount >= neededAirlocks ? 'pass' : airlockCount === 0 ? 'fail' : 'warn',
      detail: `${airlockCount} placed, ${neededAirlocks} required for ${config.crewSize} crew`,
    },
    {
      id: 'life-support',
      label: 'Life Support zone present',
      status: types.has('life-support') ? 'pass' : 'fail',
      detail: types.has('life-support') ? 'Life support active' : 'No life support — mission-critical system',
    },
    {
      id: 'command-present',
      label: 'Command zone present',
      status: types.has('command') ? 'pass' : 'fail',
      detail: types.has('command') ? 'Command center operational' : 'No command zone — operations control required',
    },
    {
      id: 'egress-routes',
      label: 'All zones have A* egress routes to airlock',
      status: noExitIds.size === 0 ? 'pass' : noExitIds.size === zones.filter(z => z.type !== 'airlock').length ? 'fail' : 'warn',
      detail: noExitIds.size === 0
        ? `${egressPaths.filter(p => p.hasExit).length} routes computed via A* pathfinding`
        : `${noExitIds.size} zone(s) with no reachable airlock`,
    },
    {
      id: 'no-high-conflicts',
      label: 'No high-severity adjacency conflicts',
      status: highConflicts.length === 0 ? 'pass' : 'fail',
      detail: highConflicts.length === 0 ? 'No critical conflicts' : `${highConflicts.length} critical conflict(s) from adjacency matrix`,
    },
    {
      id: 'no-medium-conflicts',
      label: 'No medium-severity conflicts',
      status: medConflicts.length === 0 ? 'pass' : 'warn',
      detail: medConflicts.length === 0 ? 'No comfort conflicts' : `${medConflicts.length} comfort conflict(s)`,
    },
    {
      id: 'no-overlaps',
      label: 'No overlapping zones',
      status: overlaps === 0 ? 'pass' : overlaps > 2 ? 'fail' : 'warn',
      detail: overlaps === 0 ? 'All zones spatially separated' : `${overlaps} overlapping zone pair(s)`,
    },
  ];

  // Add long-mission-specific rules
  if (longMission) {
    rules.push({
      id: 'hygiene-present',
      label: 'Hygiene zone present (long-duration mission)',
      status: types.has('hygiene') ? 'pass' : 'warn',
      detail: types.has('hygiene') ? 'Hygiene facilities available' : 'Recommended for missions > 90 days',
    });
    rules.push({
      id: 'exercise-present',
      label: 'Exercise zone present (long-duration mission)',
      status: types.has('exercise') ? 'pass' : 'warn',
      detail: types.has('exercise') ? 'Exercise equipment available' : 'Countermeasure for microgravity/low-g effects',
    });
  }

  // Add crew-size-dependent rules
  if (config.crewSize >= 6) {
    rules.push({
      id: 'storage-present',
      label: 'Storage zone for large crew',
      status: types.has('storage') ? 'pass' : 'warn',
      detail: types.has('storage') ? 'Storage space allocated' : 'Recommended for crews of 6+',
    });
  }

  return rules;
}

function countOverlaps(zones: PlacedZone[]): number {
  let count = 0;
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      if (rectsOverlap(zones[i], zones[j])) count++;
    }
  }
  return count;
}

/* ─────────────────────────  Smart Fixes  ───────────────────────────── */

/**
 * Generate actionable smart fixes for detected issues.
 * Each fix references specific zones and can be applied programmatically.
 */
export function generateSmartFixes(
  zones: PlacedZone[],
  config: MissionConfig,
  conflicts: Conflict[],
): SmartFix[] {
  const fixes: SmartFix[] = [];
  const types = new Set(zones.map((z) => z.type));

  // Conflict-resolution fixes: move one zone of each conflicting pair
  const seenConflictPairs = new Set<string>();
  for (const c of conflicts) {
    const pairKey = c.ruleId;
    if (seenConflictPairs.has(pairKey)) continue;
    seenConflictPairs.add(pairKey);

    // Pick the zone that's easier to move (smaller area)
    const za = zones.find((z) => z.id === c.zoneA);
    const zb = zones.find((z) => z.id === c.zoneB);
    if (!za || !zb) continue;
    const moveZone = za.width * za.height <= zb.width * zb.height ? za : zb;
    const stayZone = moveZone === za ? zb : za;

    fixes.push({
      id: `fix-conflict-${c.zoneA}-${c.zoneB}`,
      label: `Move ${moveZone.label} away from ${stayZone.label}`,
      zoneId: moveZone.id,
      action: 'move',
      detail: c.reason,
    });
  }

  // Missing zone fixes
  const requiredAdditions: { type: PlacedZone['type']; label: string; detail: string }[] = [];
  if (!types.has('medical')) requiredAdditions.push({ type: 'medical', label: 'Add Medical zone', detail: 'Medical zone required for crew safety' });
  if (!types.has('airlock')) requiredAdditions.push({ type: 'airlock', label: 'Add Airlock zone', detail: 'At least one egress point required' });
  if (!types.has('life-support')) requiredAdditions.push({ type: 'life-support', label: 'Add Life Support zone', detail: 'Life support is mission-critical' });
  if (!types.has('command')) requiredAdditions.push({ type: 'command', label: 'Add Command zone', detail: 'Command center for operations' });

  const sleepCount = zones.filter((z) => z.type === 'sleep').length;
  const needed = Math.ceil(config.crewSize / 2);
  if (sleepCount < needed) {
    requiredAdditions.push({ type: 'sleep', label: `Add ${needed - sleepCount} Sleep zone(s)`, detail: `Need ${needed} for ${config.crewSize} crew` });
  }

  for (const add of requiredAdditions) {
    fixes.push({
      id: `fix-add-${add.type}`,
      label: add.label,
      zoneId: '',
      action: 'add',
      detail: add.detail,
      targetType: add.type,
    });
  }

  return fixes.slice(0, 6);
}

/* ─────────────────────  Smart fix application  ─────────────────────── */

/**
 * Find the best position to move a zone to — maximizes distance from all other zones.
 * Uses grid search over the canvas.
 */
export function findBestRelocation(
  zone: PlacedZone,
  allZones: PlacedZone[],
  width: number,
  height: number,
): { x: number; y: number } {
  const others = allZones.filter((z) => z.id !== zone.id);
  let bestX = zone.x;
  let bestY = zone.y;
  let bestScore = -Infinity;

  for (let gx = 0; gx <= width - zone.width; gx += GRID_SIZE * 2) {
    for (let gy = 0; gy <= height - zone.height; gy += GRID_SIZE * 2) {
      const cx = gx + zone.width / 2;
      const cy = gy + zone.height / 2;
      let minDist = Infinity;
      let hasOverlap = false;
      for (const o of others) {
        // Check overlap
        if (
          gx < o.x + o.width && gx + zone.width > o.x &&
          gy < o.y + o.height && gy + zone.height > o.y
        ) {
          hasOverlap = true;
          break;
        }
        const oc = zoneCenter(o);
        const d = Math.sqrt((cx - oc.x) ** 2 + (cy - oc.y) ** 2);
        if (d < minDist) minDist = d;
      }
      if (hasOverlap) continue;
      // Score: prefer max distance from nearest neighbor, with mild center preference
      const centerDist = Math.sqrt((cx - width / 2) ** 2 + (cy - height / 2) ** 2);
      const score = minDist - centerDist * 0.1;
      if (score > bestScore) {
        bestScore = score;
        bestX = gx;
        bestY = gy;
      }
    }
  }
  return { x: snapToGrid(bestX), y: snapToGrid(bestY) };
}

/**
 * Find a free spot on the canvas to place a new zone.
 */
export function findFreeSpot(
  zoneType: PlacedZone['type'],
  allZones: PlacedZone[],
  width: number,
  height: number,
): { x: number; y: number } {
  const def = allZones.length === 0 ? { w: 100, h: 80 } : { w: 120, h: 90 };
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = snapToGrid(20 + Math.random() * (width - def.w - 40));
    const y = snapToGrid(20 + Math.random() * (height - def.h - 40));
    let overlap = false;
    for (const o of allZones) {
      if (x < o.x + o.width && x + def.w > o.x && y < o.y + o.height && y + def.h > o.y) {
        overlap = true;
        break;
      }
    }
    if (!overlap) return { x, y };
  }
  return { x: snapToGrid(20), y: snapToGrid(20) };
}

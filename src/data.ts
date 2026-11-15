import type { ZoneDef, ZoneType, MissionType, AdjacencyRule, AdjacencyMatrix, HabitatShape } from './types';

export const ZONE_DEFS: ZoneDef[] = [
  { type: 'sleep', label: 'Sleep', color: '#3b82f6', icon: 'BedDouble', noiseLevel: 35, minArea: 8, defaultSize: { w: 120, h: 80 } },
  { type: 'exercise', label: 'Exercise', color: '#f59e0b', icon: 'Dumbbell', noiseLevel: 80, minArea: 10, defaultSize: { w: 120, h: 90 } },
  { type: 'galley', label: 'Galley', color: '#22c55e', icon: 'Utensils', noiseLevel: 60, minArea: 8, defaultSize: { w: 100, h: 80 } },
  { type: 'medical', label: 'Medical', color: '#ef4444', icon: 'Stethoscope', noiseLevel: 40, minArea: 10, defaultSize: { w: 120, h: 100 } },
  { type: 'lab', label: 'Lab', color: '#a855f7', icon: 'FlaskConical', noiseLevel: 50, minArea: 12, defaultSize: { w: 140, h: 100 } },
  { type: 'storage', label: 'Storage', color: '#64748b', icon: 'Package', noiseLevel: 30, minArea: 6, defaultSize: { w: 80, h: 80 } },
  { type: 'hygiene', label: 'Hygiene', color: '#06b6d4', icon: 'ShowerHead', noiseLevel: 55, minArea: 6, defaultSize: { w: 80, h: 80 } },
  { type: 'command', label: 'Command', color: '#e2e8f0', icon: 'Radar', noiseLevel: 55, minArea: 10, defaultSize: { w: 120, h: 90 } },
  { type: 'airlock', label: 'Airlock', color: '#84cc16', icon: 'DoorOpen', noiseLevel: 65, minArea: 8, defaultSize: { w: 90, h: 90 } },
  { type: 'life-support', label: 'Life Support', color: '#14b8a6', icon: 'Wind', noiseLevel: 75, minArea: 10, defaultSize: { w: 110, h: 90 } },
];

export const ZONE_MAP: Record<ZoneType, ZoneDef> = ZONE_DEFS.reduce(
  (acc, z) => ({ ...acc, [z.type]: z }),
  {} as Record<ZoneType, ZoneDef>
);

export const ALL_ZONE_TYPES: ZoneType[] = ZONE_DEFS.map((z) => z.type);

export const MISSION_DEFS: { type: MissionType; label: string; desc: string; icon: string; gradient: string; defaultDuration: number; defaultDims: { w: number; h: number } }[] = [
  { type: 'lunar', label: 'Lunar Surface', desc: 'Permanent outpost on the Moon', icon: 'Moon', gradient: 'from-slate-500 to-slate-700', defaultDuration: 180, defaultDims: { w: 720, h: 540 } },
  { type: 'mars-transit', label: 'Mars Transit', desc: 'Deep-space voyage habitat', icon: 'Rocket', gradient: 'from-orange-500 to-red-600', defaultDuration: 270, defaultDims: { w: 720, h: 540 } },
  { type: 'mars-surface', label: 'Mars Surface', desc: 'Red planet colony base', icon: 'Mountain', gradient: 'from-red-500 to-amber-700', defaultDuration: 365, defaultDims: { w: 720, h: 540 } },
  { type: 'orbital', label: 'Orbital Station', desc: 'Free-fall research station', icon: 'Satellite', gradient: 'from-cyan-500 to-blue-600', defaultDuration: 90, defaultDims: { w: 720, h: 540 } },
];

/**
 * Adjacency conflict rules — defines the zone-type conflict graph.
 * These rules populate a symmetric adjacency matrix used by detectConflicts().
 *
 * Engineering assumptions (simplified for prototype):
 * - maxDist is in canvas pixels, representing a proximity threshold
 * - severity 'high' = critical safety/habitability issue, 'medium' = comfort degradation
 * - Rules are symmetric: if A conflicts with B, B conflicts with A
 */
export const CONFLICT_RULES: AdjacencyRule[] = [
  { a: 'sleep', b: 'exercise', reason: 'Potential noise and activity conflict', severity: 'high', maxDist: 160 },
  { a: 'sleep', b: 'life-support', reason: 'Machinery noise disrupts sleep cycles', severity: 'high', maxDist: 140 },
  { a: 'sleep', b: 'galley', reason: 'Cooking noise and smells near rest area', severity: 'medium', maxDist: 120 },
  { a: 'sleep', b: 'command', reason: 'Operational noise near sleep quarters', severity: 'medium', maxDist: 120 },
  { a: 'galley', b: 'hygiene', reason: 'Sanitation conflict with food preparation', severity: 'high', maxDist: 120 },
  { a: 'medical', b: 'exercise', reason: 'Vibration interference with medical equipment', severity: 'medium', maxDist: 130 },
  { a: 'command', b: 'life-support', reason: 'EM interference with command systems', severity: 'medium', maxDist: 130 },
  { a: 'lab', b: 'exercise', reason: 'Contamination risk from high-activity zone', severity: 'medium', maxDist: 120 },
  { a: 'lab', b: 'galley', reason: 'Biological contamination risk near food prep', severity: 'medium', maxDist: 110 },
];

/**
 * Build a symmetric adjacency matrix from the conflict rules.
 * Key format: "typeA:typeB" (always ordered so typeA < typeB lexicographically)
 */
export function buildAdjacencyMatrix(rules: AdjacencyRule[]): AdjacencyMatrix {
  const matrix: AdjacencyMatrix = {};
  for (const rule of rules) {
    const key = rule.a < rule.b ? `${rule.a}:${rule.b}` : `${rule.b}:${rule.a}`;
    matrix[key] = rule;
  }
  return matrix;
}

export const ADJACENCY_MATRIX = buildAdjacencyMatrix(CONFLICT_RULES);

/** Check if two zone types have a conflict rule in the adjacency matrix */
export function getConflictRule(a: ZoneType, b: ZoneType): AdjacencyRule | null {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  return ADJACENCY_MATRIX[key] ?? null;
}

export const GRID_SIZE = 20;
export const CANVAS_W = 720;
export const CANVAS_H = 540;

/** Pathfinding grid cell size — coarser than the snap grid for A* performance */
export const PATH_GRID_SIZE = 20;

/** Default mission config values */
export const DEFAULT_DURATION = 180;
export const DEFAULT_DIMS: { w: number; h: number } = { w: CANVAS_W, h: CANVAS_H };

export const HABITAT_SHAPES: { value: HabitatShape; label: string }[] = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'l-shape', label: 'L-Shape' },
];

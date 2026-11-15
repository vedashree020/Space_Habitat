import type { ZoneDef, ZoneType, MissionType } from './types';

export const ZONE_DEFS: ZoneDef[] = [
  { type: 'sleep', label: 'Sleep', color: '#3b82f6', icon: 'BedDouble', noiseLevel: 15, minArea: 8, defaultSize: { w: 120, h: 80 } },
  { type: 'exercise', label: 'Exercise', color: '#f59e0b', icon: 'Dumbbell', noiseLevel: 85, minArea: 10, defaultSize: { w: 120, h: 90 } },
  { type: 'galley', label: 'Galley', color: '#22c55e', icon: 'Utensils', noiseLevel: 55, minArea: 8, defaultSize: { w: 100, h: 80 } },
  { type: 'medical', label: 'Medical', color: '#ef4444', icon: 'Stethoscope', noiseLevel: 25, minArea: 10, defaultSize: { w: 120, h: 100 } },
  { type: 'lab', label: 'Lab', color: '#a855f7', icon: 'FlaskConical', noiseLevel: 40, minArea: 12, defaultSize: { w: 140, h: 100 } },
  { type: 'storage', label: 'Storage', color: '#64748b', icon: 'Package', noiseLevel: 20, minArea: 6, defaultSize: { w: 80, h: 80 } },
  { type: 'hygiene', label: 'Hygiene', color: '#06b6d4', icon: 'ShowerHead', noiseLevel: 45, minArea: 6, defaultSize: { w: 80, h: 80 } },
  { type: 'command', label: 'Command', color: '#e2e8f0', icon: 'Radar', noiseLevel: 50, minArea: 10, defaultSize: { w: 120, h: 90 } },
  { type: 'airlock', label: 'Airlock', color: '#84cc16', icon: 'DoorOpen', noiseLevel: 35, minArea: 8, defaultSize: { w: 90, h: 90 } },
  { type: 'life-support', label: 'Life Support', color: '#14b8a6', icon: 'Wind', noiseLevel: 70, minArea: 10, defaultSize: { w: 110, h: 90 } },
];

export const ZONE_MAP: Record<ZoneType, ZoneDef> = ZONE_DEFS.reduce(
  (acc, z) => ({ ...acc, [z.type]: z }),
  {} as Record<ZoneType, ZoneDef>
);

export const MISSION_DEFS: { type: MissionType; label: string; desc: string; icon: string; gradient: string }[] = [
  { type: 'lunar', label: 'Lunar Surface', desc: 'Permanent outpost on the Moon', icon: 'Moon', gradient: 'from-slate-500 to-slate-700' },
  { type: 'mars-transit', label: 'Mars Transit', desc: 'Deep-space voyage habitat', icon: 'Rocket', gradient: 'from-orange-500 to-red-600' },
  { type: 'mars-surface', label: 'Mars Surface', desc: 'Red planet colony base', icon: 'Mountain', gradient: 'from-red-500 to-amber-700' },
  { type: 'orbital', label: 'Orbital Station', desc: 'Free-fall research station', icon: 'Satellite', gradient: 'from-cyan-500 to-blue-600' },
];

// Hard-coded adjacency conflict rules
export const CONFLICT_RULES: { a: ZoneType; b: ZoneType; reason: string; severity: 'high' | 'medium'; maxDist: number }[] = [
  { a: 'sleep', b: 'exercise', reason: 'Potential noise and activity conflict', severity: 'high', maxDist: 160 },
  { a: 'sleep', b: 'life-support', reason: 'Machinery noise disrupts sleep cycles', severity: 'high', maxDist: 140 },
  { a: 'sleep', b: 'galley', reason: 'Cooking noise and smells near rest area', severity: 'medium', maxDist: 120 },
  { a: 'galley', b: 'hygiene', reason: 'Sanitation conflict with food prep', severity: 'high', maxDist: 120 },
  { a: 'medical', b: 'exercise', reason: 'Vibration interference with medical equipment', severity: 'medium', maxDist: 130 },
  { a: 'command', b: 'life-support', reason: 'EM interference with command systems', severity: 'medium', maxDist: 130 },
  { a: 'lab', b: 'exercise', reason: 'Contamination risk from activity zone', severity: 'medium', maxDist: 120 },
];

export const GRID_SIZE = 20;
export const CANVAS_W = 720;
export const CANVAS_H = 540;

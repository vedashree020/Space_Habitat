export type MissionType = 'lunar' | 'mars-transit' | 'mars-surface' | 'orbital';
export type HabitatShape = 'rectangle' | 'circle' | 'l-shape';
export type ZoneType =
  | 'sleep'
  | 'exercise'
  | 'galley'
  | 'medical'
  | 'lab'
  | 'storage'
  | 'hygiene'
  | 'command'
  | 'airlock'
  | 'life-support';

export type RuleStatus = 'pass' | 'warn' | 'fail';

export interface ZoneDef {
  type: ZoneType;
  label: string;
  color: string;
  icon: string;
  noiseLevel: number; // base noise dB at source
  minArea: number; // in grid cells
  defaultSize: { w: number; h: number };
}

export interface PlacedZone {
  id: string;
  type: ZoneType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  noiseLevel: number;
}

export interface MissionConfig {
  type: MissionType;
  label: string;
  crewSize: number;
  shape: HabitatShape;
  durationDays: number;
  dimensions: { w: number; h: number };
}

export interface Conflict {
  zoneA: string;
  zoneB: string;
  labelA: string;
  labelB: string;
  midX: number;
  midY: number;
  reason: string;
  severity: 'high' | 'medium';
  distance: number;
  ruleId: string;
}

/** Adjacency matrix entry — which zone type pairs conflict and why */
export interface AdjacencyRule {
  a: ZoneType;
  b: ZoneType;
  reason: string;
  severity: 'high' | 'medium';
  maxDist: number;
}

/** Graph adjacency matrix: key = "typeA:typeB", value = rule */
export type AdjacencyMatrix = Record<string, AdjacencyRule>;

export interface EgressPath {
  zoneId: string;
  airlockId: string;
  waypoints: { x: number; y: number }[];
  pathLength: number;
  hasExit: boolean;
}

export interface LayoutVersion {
  id: string;
  name: string;
  zones: PlacedZone[];
  score: number;
  metrics: ScoreMetrics;
  conflicts: Conflict[];
  config: MissionConfig;
  createdAt: number;
}

export interface ScoreMetrics {
  safety: number;
  accessibility: number;
  acoustic: number;
  efficiency: number;
  compliance: number;
}

export interface RuleCheck {
  id: string;
  label: string;
  status: RuleStatus;
  detail: string;
}

export interface SmartFix {
  id: string;
  label: string;
  zoneId: string;
  action: 'move' | 'add';
  detail: string;
  targetType?: ZoneType;
}

export interface ScoreMethodology {
  weights: { safety: number; accessibility: number; acoustic: number; efficiency: number; compliance: number };
  factors: { metric: string; formula: string; value: number }[];
}

export type Screen = 'landing' | 'editor' | 'compare';

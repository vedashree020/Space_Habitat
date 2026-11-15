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

export interface ZoneDef {
  type: ZoneType;
  label: string;
  color: string;
  icon: string;
  noiseLevel: number; // 0-100
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
  passed: boolean;
  detail: string;
}

export interface SmartFix {
  id: string;
  label: string;
  zoneId: string;
  action: 'move' | 'add';
  detail: string;
}

export type Screen = 'landing' | 'editor' | 'compare';

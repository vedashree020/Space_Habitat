import type { PlacedZone, MissionConfig } from './types';
import { ZONE_MAP } from './data';

let idCounter = 0;
export function genId(): string {
  idCounter++;
  return `zone-${Date.now()}-${idCounter}`;
}

export function createZone(type: PlacedZone['type'], x: number, y: number): PlacedZone {
  const def = ZONE_MAP[type];
  return {
    id: genId(),
    type,
    label: def.label,
    x,
    y,
    width: def.defaultSize.w,
    height: def.defaultSize.h,
    rotation: 0,
    color: def.color,
    noiseLevel: def.noiseLevel,
  };
}

export function getDemoLayout(config: MissionConfig): PlacedZone[] {
  const zones: PlacedZone[] = [];

  // Sleep placed right next to Exercise (intentional conflict for demo)
  zones.push(createZone('sleep', 40, 40));
  zones.push(createZone('exercise', 180, 40));

  zones.push(createZone('galley', 320, 40));
  zones.push(createZone('hygiene', 440, 40));
  zones.push(createZone('medical', 40, 180));
  zones.push(createZone('lab', 180, 180));
  zones.push(createZone('command', 340, 180));
  zones.push(createZone('life-support', 480, 180));
  zones.push(createZone('storage', 40, 320));
  zones.push(createZone('airlock', 580, 320));

  return zones;
}

export function saveLayouts(layouts: PlacedZone[][]) {
  // unused placeholder for compatibility
}

const LAYOUT_KEY = 'habitatos-layouts';

export interface StoredLayout {
  id: string;
  name: string;
  zones: PlacedZone[];
  config: MissionConfig;
  score: number;
  conflictsCount: number;
  createdAt: number;
}

export function getStoredLayouts(): StoredLayout[] {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function storeLayout(layout: StoredLayout): StoredLayout[] {
  const existing = getStoredLayouts();
  const updated = [layout, ...existing].slice(0, 8);
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteStoredLayout(id: string): StoredLayout[] {
  const existing = getStoredLayouts().filter((l) => l.id !== id);
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(existing));
  return existing;
}

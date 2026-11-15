import type { PlacedZone, MissionConfig, ScoreMetrics, Conflict } from './types';
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

export function getDemoLayout(_config: MissionConfig): PlacedZone[] {
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

/* ───────────────────  IndexedDB persistence  ─────────────────── */

const DB_NAME = 'HabitatOS';
const DB_VERSION = 1;
const STORE_NAME = 'layouts';

export interface StoredLayout {
  id: string;
  name: string;
  zones: PlacedZone[];
  config: MissionConfig;
  score: number;
  metrics: ScoreMetrics;
  conflictsCount: number;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function getStoredLayouts(): Promise<StoredLayout[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result as StoredLayout[]).sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function storeLayout(layout: StoredLayout): Promise<StoredLayout[]> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(layout);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return getStoredLayouts();
}

export async function deleteStoredLayout(id: string): Promise<StoredLayout[]> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return getStoredLayouts();
}

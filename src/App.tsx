import { useState } from 'react';
import type { MissionConfig, PlacedZone, Screen } from './types';
import { getDemoLayout, deleteStoredLayout, type StoredLayout } from './storage';
import LandingScreen from './components/LandingScreen';
import EditorScreen from './components/EditorScreen';
import CompareScreen from './components/CompareScreen';

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [config, setConfig] = useState<MissionConfig | null>(null);
  const [zones, setZones] = useState<PlacedZone[]>([]);
  const [savedLayouts, setSavedLayouts] = useState<StoredLayout[]>([]);

  const handleStart = (cfg: MissionConfig) => {
    setConfig(cfg);
    setZones(getDemoLayout(cfg));
    setScreen('editor');
  };

  const handleGoHome = () => {
    setScreen('landing');
  };

  const handleGoCompare = (layouts: StoredLayout[]) => {
    setSavedLayouts(layouts);
    setScreen('compare');
  };

  const handleDeleteLayout = (id: string) => {
    const updated = deleteStoredLayout(id);
    setSavedLayouts(updated);
  };

  if (screen === 'landing') {
    return <LandingScreen onStart={handleStart} />;
  }

  if (screen === 'compare') {
    return (
      <CompareScreen
        layouts={savedLayouts}
        onBack={() => setScreen('editor')}
        onDelete={handleDeleteLayout}
      />
    );
  }

  if (screen === 'editor' && config) {
    return (
      <EditorScreen
        config={config}
        initialZones={zones}
        onGoHome={handleGoHome}
        onGoCompare={handleGoCompare}
      />
    );
  }

  return <LandingScreen onStart={handleStart} />;
}

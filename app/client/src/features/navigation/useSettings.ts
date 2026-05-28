import { useState, useCallback } from 'react';

export function useSettings() {
  const [showSettings, setShowSettings] = useState(false);

  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  return { showSettings, openSettings, closeSettings, setShowSettings };
}
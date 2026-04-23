import { useEffect, useState } from 'react';
import {
  settingsService,
} from '@sdkwork/claw-core';

export function useChatCompactModelPreference(): boolean {
  const [compactModelSelector, setCompactModelSelector] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void settingsService
      .getPreferences()
      .then((preferences) => {
        if (!cancelled) {
          setCompactModelSelector(preferences.general.compactModelSelector);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompactModelSelector(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return compactModelSelector;
}

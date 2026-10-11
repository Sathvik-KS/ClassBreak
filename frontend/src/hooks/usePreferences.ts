// Hook for managing user preferences in IndexedDB

import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureDefaults } from '../db/database';
import type { Preferences } from '../types';
import { useEffect } from 'react';

// Module-level default so re-renders don't create new object identities
// or call impure Date during render.
const DEFAULT_PREFERENCES: Preferences = {
  id: 'default',
  interests: [],
  excludedTopics: [],
  defaultDuration: 5,
  theme: 'light',
  updatedAt: new Date(0).toISOString(),
};

export function usePreferences() {
  useEffect(() => {
    ensureDefaults();
  }, []);

  const preferences = useLiveQuery(() => db.preferences.get('default'));

  const updatePreferences = async (updates: Partial<Preferences>) => {
    // put() (not update()) so a race with async ensureDefaults can't silently
    // no-op when the 'default' row doesn't exist yet.
    const current = await db.preferences.get('default');
    await db.preferences.put({
      ...DEFAULT_PREFERENCES,
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleInterest = async (interest: string) => {
    const current = preferences?.interests ?? [];
    const newInterests = current.includes(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest];
    await updatePreferences({ interests: newInterests });
  };

  const setDuration = async (duration: number) => {
    await updatePreferences({ defaultDuration: duration });
  };

  return {
    preferences: preferences ?? DEFAULT_PREFERENCES,
    updatePreferences,
    toggleInterest,
    setDuration,
    isLoaded: preferences !== undefined,
  };
}

// Hook for managing user preferences in IndexedDB

import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureDefaults } from '../db/database';
import type { Preferences } from '../types';
import { useEffect } from 'react';

export function usePreferences() {
  useEffect(() => {
    ensureDefaults();
  }, []);

  const preferences = useLiveQuery(() => db.preferences.get('default'));

  const updatePreferences = async (updates: Partial<Preferences>) => {
    await db.preferences.update('default', {
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
    preferences: preferences ?? {
      id: 'default',
      interests: [],
      excludedTopics: [],
      defaultDuration: 5,
      theme: 'light' as const,
      updatedAt: new Date().toISOString(),
    },
    updatePreferences,
    toggleInterest,
    setDuration,
    isLoaded: preferences !== undefined,
  };
}

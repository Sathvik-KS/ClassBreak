import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getSavedLessons, removeSavedLesson } from '@/services/lessonStore';
import type { SavedLesson } from '@/types';
import { getDomainColor } from '@/utils/domain-colors';

type SavedStatus = 'loading' | 'ready' | 'error';

/** Saved lessons tab: everything the user chose to keep, stored on-device. */
export default function SavedScreen() {
  const [lessons, setLessons] = useState<SavedLesson[]>([]);
  const [status, setStatus] = useState<SavedStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // Reloads the list without any synchronous setState, so it is safe to
  // call both from the focus effect and from the retry button.
  const loadSaved = useCallback(() => {
    getSavedLessons()
      .then((saved) => {
        setLessons(saved);
        setStatus('ready');
      })
      .catch((e: unknown) => {
        setErrorMessage(e instanceof Error ? e.message : 'Could not read saved lessons.');
        setStatus('error');
      });
  }, []);

  // Reload on every focus so saves made on other screens show up here.
  // No cancellation on purpose: tab screens stay mounted, so the result is
  // still wanted even if the user glances away while it loads.
  useFocusEffect(useCallback(() => loadSaved(), [loadSaved]));

  const retry = useCallback(() => {
    // Event handler: synchronous setState here is fine.
    setStatus('loading');
    setErrorMessage('');
    loadSaved();
  }, [loadSaved]);

  const removeLesson = useCallback(async (id: string) => {
    // Event handler: synchronous setState here is fine.
    try {
      await removeSavedLesson(id);
      setLessons((prev) => prev.filter((lesson) => lesson.id !== id));
    } catch {
      setErrorMessage('Could not update saved lessons.');
    }
  }, []);

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.centered}>
          <ActivityIndicator size="large" />
          <ThemedText themeColor="textSecondary">Loading saved lessons…</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.centered}>
          <ThemedText type="subtitle" style={styles.centeredText}>
            Saved lessons unavailable
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            {errorMessage}
          </ThemedText>
          <Pressable
            onPress={retry}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.buttonText}>
              Retry
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ThemedView style={styles.container}>
        <FlatList
          data={lessons}
          keyExtractor={(lesson) => lesson.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="title">Saved</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                {lessons.length === 0
                  ? 'Lessons you keep are stored on this device.'
                  : `${lessons.length} lesson${lessons.length === 1 ? '' : 's'} stored on this device.`}
              </ThemedText>
            </View>
          }
          ListEmptyComponent={
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText type="subtitle" style={styles.centeredText}>
                No saved lessons yet
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centeredText}>
                Open a lesson from Discover and tap “Save lesson” to keep it here.
              </ThemedText>
              <Pressable
                onPress={() => router.push('/')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={styles.buttonText}>
                  Go to Discover
                </ThemedText>
              </Pressable>
            </ThemedView>
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.card}>
              <Pressable
                onPress={() => router.push({ pathname: '/saved/[id]', params: { id: item.id } })}
                style={({ pressed }) => pressed && styles.pressed}>
                <View style={styles.chipRow}>
                  <View
                    style={[styles.domainChip, { backgroundColor: getDomainColor(item.domain) }]}>
                    <ThemedText type="small" style={styles.chipText}>
                      {item.domain}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.difficulty} · {item.duration_minutes} min
                  </ThemedText>
                </View>
                <ThemedText type="subtitle">{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {item.summary}
                </ThemedText>
              </Pressable>
              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => void removeLesson(item.id)}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Remove
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          )}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  centeredText: {
    textAlign: 'center',
  },
  header: {
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  subtitle: {
    lineHeight: 22,
  },
  listContent: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
    gap: Spacing.three,
  },
  emptyCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    alignItems: 'center',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  domainChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
  },
  chipText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.one,
  },
  primaryButton: {
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  buttonText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.7,
  },
});

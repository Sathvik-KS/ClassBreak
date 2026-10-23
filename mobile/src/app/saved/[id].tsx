import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { LessonContent } from '@/components/lesson-content';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getSavedLesson } from '@/services/lessonStore';
import type { SavedLesson } from '@/types';
import { isLessonShape } from '@/utils/helpers';

type LoadStatus = 'loading' | 'ready' | 'error';

/** Opens one saved lesson straight from device storage — no AI call, so it
 *  also works offline. */
export default function SavedLessonScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const theme = useTheme();

  const [lesson, setLesson] = useState<SavedLesson | null>(null);
  const [status, setStatus] = useState<LoadStatus>(id === '' ? 'error' : 'loading');
  const [errorMessage, setErrorMessage] = useState(
    id === '' ? 'This screen needs a lesson id.' : '',
  );

  // Reload on focus: the user may have removed the lesson on the Saved tab.
  useFocusEffect(
    useCallback(() => {
      if (id === '') return;
      let cancelled = false;
      getSavedLesson(id)
        .then((stored) => {
          if (cancelled) return;
          // Storage is a trust boundary too: corrupted or old-schema JSON
          // gets the same "no lesson" error instead of a render crash.
          if (stored === undefined || !isLessonShape(stored)) {
            setErrorMessage('This lesson is no longer in your saved list.');
            setStatus('error');
            return;
          }
          setLesson(stored);
          setStatus('ready');
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setErrorMessage(e instanceof Error ? e.message : 'Could not read the saved lesson.');
          setStatus('error');
        });
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  if (status === 'loading') {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
        <ThemedText themeColor="textSecondary">Opening saved lesson…</ThemedText>
      </ThemedView>
    );
  }

  if (status === 'error' || !lesson) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Lesson' }} />
        <ThemedText type="subtitle" style={styles.centeredText}>
          Lesson not found
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {errorMessage}
        </ThemedText>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.buttonText}>
            Go back
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: lesson.topic }} />
      <LessonContent lesson={lesson} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
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
  backButton: {
    marginTop: Spacing.two,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.7,
  },
});

import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { LessonContent } from '@/components/lesson-content';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/services/api';
import type { Lesson } from '@/types';

type LessonStatus = 'loading' | 'ready' | 'error';

export default function LessonScreen() {
  const params = useLocalSearchParams<{ topic: string; title?: string }>();
  const topic = typeof params.topic === 'string' ? params.topic : '';
  const theme = useTheme();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [status, setStatus] = useState<LessonStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const generate = useCallback(async () => {
    // No synchronous setState before the await; used from event handlers
    // (retry button), which may set loading state synchronously.
    try {
      const result = await api.generateLesson({ topic, duration_minutes: 5 });
      setLesson(result);
      setStatus('ready');
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Something went wrong');
      setStatus('error');
    }
  }, [topic]);

  const retry = useCallback(() => {
    // Event handlers may set loading state synchronously (lint-safe).
    setStatus('loading');
    setErrorMessage('');
    generate();
  }, [generate]);

  // Mount load: fetch callbacks (sanctioned pattern for effects) rather
  // than calling an async function directly from the effect body.
  useEffect(() => {
    let cancelled = false;
    api
      .generateLesson({ topic, duration_minutes: 5 })
      .then((result) => {
        if (cancelled) return;
        setLesson(result);
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setErrorMessage(e instanceof ApiError ? e.message : 'Something went wrong');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [topic]);

  if (status === 'loading') {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          Generating your lesson…
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
          {topic}
        </ThemedText>
      </ThemedView>
    );
  }

  if (status === 'error' || !lesson) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle" style={styles.centeredText}>
          Couldn&apos;t generate the lesson
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {errorMessage}
        </ThemedText>
        <Pressable
          onPress={retry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.retryText}>
            Retry
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
  retryButton: {
    marginTop: Spacing.two,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  retryText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.7,
  },
});

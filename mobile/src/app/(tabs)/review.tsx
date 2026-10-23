import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getReviewItems, getSavedLessons, updateReview } from '@/services/lessonStore';
import type { ReviewItem, SavedLesson } from '@/types';
import { formatDate } from '@/utils/helpers';
import { getDomainColor } from '@/utils/domain-colors';

/** A review schedule joined with the saved lesson it belongs to. */
type ReviewEntry = { item: ReviewItem; lesson: SavedLesson };

type ReviewStatus = 'loading' | 'ready' | 'error';

/** Review tab: lessons due for a refresher, plus what is scheduled later.
 *
 *  Simplification vs the web app: reviews are marked from this screen with
 *  self-reported "remembered / need another pass" buttons (same as the web
 *  Review page) or automatically when a quiz finishes. This app has no
 *  separate review-history records. */
export default function ReviewScreen() {
  const theme = useTheme();
  // Secondary (non-accent) buttons must follow the theme background or
  // their label becomes unreadable in dark mode.
  const secondaryButtonStyle = [
    styles.secondaryButton,
    { backgroundColor: theme.backgroundSelected },
  ];
  const [due, setDue] = useState<ReviewEntry[]>([]);
  const [upcoming, setUpcoming] = useState<ReviewEntry[]>([]);
  const [status, setStatus] = useState<ReviewStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  // Non-null while a "remembered / need another pass" request is running —
  // prevents double taps scheduling the same review twice.
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Joins stored review items with their saved lessons and splits them by
  // due date. No synchronous setState, so it is safe from the focus effect.
  const loadReviews = useCallback(() => {
    Promise.all([getSavedLessons(), getReviewItems()])
      .then(([lessons, items]) => {
        const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
        const joined = items
          .map((item) => ({ item, lesson: lessonById.get(item.lessonId) }))
          // Skip schedules whose lesson was deleted (orphaned items).
          .filter((entry): entry is ReviewEntry => entry.lesson !== undefined)
          .sort((a, b) => a.item.nextReviewAt.localeCompare(b.item.nextReviewAt));
        const now = Date.now();
        setDue(joined.filter((entry) => Date.parse(entry.item.nextReviewAt) <= now));
        setUpcoming(joined.filter((entry) => Date.parse(entry.item.nextReviewAt) > now));
        setStatus('ready');
      })
      .catch((e: unknown) => {
        setErrorMessage(e instanceof Error ? e.message : 'Could not read review items.');
        setStatus('error');
      });
  }, []);

  // Reload on every focus so quiz results recorded elsewhere show up here.
  useFocusEffect(useCallback(() => loadReviews(), [loadReviews]));

  const retry = useCallback(() => {
    // Event handler: synchronous setState here is fine.
    setStatus('loading');
    setErrorMessage('');
    loadReviews();
  }, [loadReviews]);

  const markReviewed = useCallback(
    async (lessonId: string, wasCorrect: boolean) => {
      if (updatingId !== null) return; // still busy with another request
      setUpdatingId(lessonId);
      try {
        await updateReview(lessonId, wasCorrect);
        setNotice('');
        loadReviews();
      } catch {
        setNotice('Could not update the review schedule. Try again.');
      } finally {
        setUpdatingId(null);
      }
    },
    [updatingId, loadReviews],
  );

  const openLesson = useCallback((id: string) => {
    router.push({ pathname: '/saved/[id]', params: { id } });
  }, []);

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.centered}>
          <ActivityIndicator size="large" />
          <ThemedText themeColor="textSecondary">Loading reviews…</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.centered}>
          <ThemedText type="subtitle" style={styles.centeredText}>
            Reviews unavailable
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            {errorMessage}
          </ThemedText>
          <Pressable
            onPress={retry}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
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
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title">Review</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Spaced repetition keeps learning sticky
            </ThemedText>
          </View>

          {notice !== '' && (
            <ThemedText type="small" style={styles.notice}>
              {notice}
            </ThemedText>
          )}

          {due.length === 0 && upcoming.length === 0 && (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText type="subtitle" style={styles.centeredText}>
                All caught up
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centeredText}>
                Save a lesson and take its quiz to schedule reviews.
              </ThemedText>
              <Pressable
                onPress={() => router.push('/')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={styles.buttonText}>
                  Go to Discover
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {/* Due now */}
          {due.length > 0 && (
            <>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Due now
              </ThemedText>
              {due.map(({ item, lesson }) => (
                <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
                  <View style={styles.chipRow}>
                    <View
                      style={[styles.domainChip, { backgroundColor: getDomainColor(lesson.domain) }]}>
                      <ThemedText type="small" style={styles.chipText}>
                        {lesson.domain}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      Due {formatDate(item.nextReviewAt)}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => openLesson(lesson.id)}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedText type="subtitle">{lesson.title}</ThemedText>
                  </Pressable>
                  <ThemedText type="small" themeColor="textSecondary">
                    How well do you remember this?
                  </ThemedText>
                  <View style={styles.cardActions}>
                    <Pressable
                      onPress={() => void markReviewed(lesson.id, true)}
                      disabled={updatingId !== null}
                      style={({ pressed }) => [
                        styles.actionButton,
                        updatingId !== null && styles.actionDisabled,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" style={styles.buttonText}>
                        Remembered it
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => void markReviewed(lesson.id, false)}
                      disabled={updatingId !== null}
                      style={({ pressed }) => [
                        styles.actionButton,
                        secondaryButtonStyle,
                        updatingId !== null && styles.actionDisabled,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">Need another pass</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => openLesson(lesson.id)}
                      disabled={updatingId !== null}
                      style={({ pressed }) => [
                        styles.actionButton,
                        secondaryButtonStyle,
                        updatingId !== null && styles.actionDisabled,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">Re-read</ThemedText>
                    </Pressable>
                  </View>
                </ThemedView>
              ))}
            </>
          )}

          {/* Scheduled later */}
          {upcoming.length > 0 && (
            <>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Coming up
              </ThemedText>
              {upcoming.map(({ item, lesson }) => (
                <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
                  <View style={styles.chipRow}>
                    <View
                      style={[styles.domainChip, { backgroundColor: getDomainColor(lesson.domain) }]}>
                      <ThemedText type="small" style={styles.chipText}>
                        {lesson.domain}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      Next review {formatDate(item.nextReviewAt)}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => openLesson(lesson.id)}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedText type="subtitle">{lesson.title}</ThemedText>
                  </Pressable>
                </ThemedView>
              ))}
            </>
          )}
        </ScrollView>
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
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.one,
  },
  subtitle: {
    lineHeight: 22,
  },
  sectionTitle: {
    marginTop: Spacing.two,
  },
  notice: {
    color: '#ef4444',
    textAlign: 'center',
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
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionButton: {
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButton: {
    // Background color comes from the theme in the JSX.
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionDisabled: {
    opacity: 0.5,
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
  buttonText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.7,
  },
});

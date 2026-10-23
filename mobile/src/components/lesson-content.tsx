import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { MarkdownText } from '@/components/markdown-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getSavedLesson,
  removeSavedLesson,
  saveLessonIfMissing,
} from '@/services/lessonStore';
import type { Lesson } from '@/types';
import { getDomainColor } from '@/utils/domain-colors';
import { isSafeWebUrl } from '@/utils/helpers';

/** Renders one lesson (header, save/quiz actions, sections, examples,
 *  takeaways, sources). Used by both the generated-lesson screen and the
 *  saved-lesson screen so the two never drift apart. */
export function LessonContent({ lesson }: { lesson: Lesson }) {
  const theme = useTheme();
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Re-check saved status every time the screen is (re)focused, so a save
  // made elsewhere (e.g. finishing a quiz) shows up when coming back.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSavedLesson(lesson.id)
        .then((saved) => {
          if (!cancelled) setIsSaved(saved !== undefined);
        })
        .catch(() => {
          if (!cancelled) setSaveError('Could not read saved lessons.');
        });
      return () => {
        cancelled = true;
      };
    }, [lesson.id]),
  );

  const toggleSave = useCallback(async () => {
    // Event handler: synchronous setState here is fine. The `saving` guard
    // stops a second tap from racing the first one's read-modify-write.
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      if (isSaved) {
        await removeSavedLesson(lesson.id);
        setIsSaved(false);
      } else {
        await saveLessonIfMissing(lesson);
        setIsSaved(true);
      }
    } catch {
      setSaveError('Could not update saved lessons.');
    } finally {
      setSaving(false);
    }
  }, [isSaved, lesson, saving]);

  return (
    <View style={styles.stack}>
      {/* Header */}
      <ThemedText type="subtitle" style={styles.title}>
        {lesson.title}
      </ThemedText>
      <View style={styles.metaRow}>
        <View style={[styles.domainChip, { backgroundColor: getDomainColor(lesson.domain) }]}>
          <ThemedText type="small" style={styles.chipText}>
            {lesson.domain}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {lesson.difficulty} · {lesson.duration_minutes} min
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary" style={styles.summary}>
        {lesson.summary}
      </ThemedText>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => void toggleSave()}
          disabled={saving}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.actionButton,
            isSaved
              ? [
                  styles.removeButton,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  },
                ]
              : styles.saveButton,
            saving && styles.actionDisabled,
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={isSaved ? undefined : styles.onAccentText}>
            {isSaved ? 'Remove from saved' : 'Save lesson'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/quiz',
              params: { lesson: JSON.stringify(lesson) },
            })
          }
          accessibilityRole="button"
          style={({ pressed }) => [styles.actionButton, styles.quizButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.onAccentText}>
            Take quiz
          </ThemedText>
        </Pressable>
      </View>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/tutor',
            params: { lesson: JSON.stringify(lesson) },
          })
        }
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.tutorButton,
          { borderColor: theme.backgroundSelected },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold">Ask the tutor about this lesson</ThemedText>
      </Pressable>
      {saveError !== '' && (
        <ThemedText type="small" style={styles.saveError}>
          {saveError}
        </ThemedText>
      )}

      {/* Sections */}
      {lesson.sections.map((section, i) => (
        <ThemedView key={i} type="backgroundElement" style={styles.sectionCard}>
          <ThemedText type="subtitle" style={styles.sectionHeading}>
            {section.heading}
          </ThemedText>
          <MarkdownText markdown={section.content} />
          {section.key_points.length > 0 && (
            <View style={styles.keyPoints}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Key points
              </ThemedText>
              {section.key_points.map((point, j) => (
                <View key={j} style={styles.bulletRow}>
                  <ThemedText style={styles.bulletMark}>•</ThemedText>
                  <ThemedText style={styles.bulletBody}>{point}</ThemedText>
                </View>
              ))}
            </View>
          )}
        </ThemedView>
      ))}

      {/* Examples */}
      {lesson.examples.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.sectionCard}>
          <ThemedText type="subtitle" style={styles.sectionHeading}>
            Examples
          </ThemedText>
          {lesson.examples.map((example, i) => (
            <View key={i} style={styles.bulletRow}>
              <ThemedText style={styles.bulletMark}>•</ThemedText>
              <ThemedText style={styles.bulletBody}>{example}</ThemedText>
            </View>
          ))}
        </ThemedView>
      )}

      {/* Takeaways */}
      {lesson.takeaways.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.sectionCard}>
          <ThemedText type="subtitle" style={styles.sectionHeading}>
            Key takeaways
          </ThemedText>
          {lesson.takeaways.map((takeaway, i) => (
            <View key={i} style={styles.bulletRow}>
              <ThemedText style={styles.bulletMark}>✓</ThemedText>
              <ThemedText style={styles.bulletBody}>{takeaway}</ThemedText>
            </View>
          ))}
        </ThemedView>
      )}

      {/* References */}
      {lesson.references.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.sectionCard}>
          <ThemedText type="subtitle" style={styles.sectionHeading}>
            Sources
          </ThemedText>
          {lesson.references.map((ref, i) => (
            <View key={i} style={styles.reference}>
              {/* Dynamic URLs: only plain http(s) links are tappable
                  (isSafeWebUrl) — other schemes are shown as inert text. */}
              {isSafeWebUrl(ref.url) ? (
                <Pressable onPress={() => Linking.openURL(ref.url)}>
                  <ThemedText type="linkPrimary">{ref.title}</ThemedText>
                </Pressable>
              ) : (
                <ThemedText>{ref.title}</ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {ref.source_type === 'wikipedia'
                  ? 'Wikipedia (verified against fetched source)'
                  : ref.source_type === 'provided'
                    ? 'Reference provided by AI (unverified)'
                    : ref.source_type}
              </ThemedText>
            </View>
          ))}
        </ThemedView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.three,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  metaRow: {
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
  summary: {
    lineHeight: 24,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#3c87f7',
  },
  quizButton: {
    backgroundColor: '#3c87f7',
  },
  removeButton: {
    borderWidth: 1,
    // Background and border colors come from the theme in the JSX.
  },
  tutorButton: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    // Border color comes from the theme in the JSX.
  },
  onAccentText: {
    color: '#ffffff',
  },
  actionDisabled: {
    opacity: 0.5,
  },
  saveError: {
    color: '#ef4444',
    textAlign: 'center',
  },
  sectionCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  sectionHeading: {
    fontSize: 20,
    lineHeight: 26,
  },
  keyPoints: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bulletMark: {
    marginTop: 1,
  },
  bulletBody: {
    flex: 1,
    lineHeight: 24,
  },
  reference: {
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});

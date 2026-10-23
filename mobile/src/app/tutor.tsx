import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { MarkdownText } from '@/components/markdown-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/services/api';
import type { Lesson, Reference, TutorMessage } from '@/types';
import { isLessonShape, isSafeWebUrl, lessonToContext } from '@/utils/helpers';

/** Backend limit for lesson_context (TutorChatRequest). */
const MAX_CONTEXT_LENGTH = 5000;
/** Backend limit for question (TutorChatRequest). */
const MAX_QUESTION_LENGTH = 1000;

/** One visible chat turn. The request only sends role + content; the
 *  extras are display-only (answers can carry references and prompts). */
type ChatTurn = TutorMessage & {
  references?: Reference[];
  suggestions?: string[];
};

/** Tutor chat screen. The lesson arrives as a JSON route param (same
 *  pattern as the quiz screen) and its text provides lesson_context for
 *  POST /api/tutor/chat. */
export default function TutorScreen() {
  const params = useLocalSearchParams<{ lesson?: string }>();
  const theme = useTheme();

  const [lesson] = useState<Lesson | null>(() => {
    if (typeof params.lesson !== 'string') return null;
    try {
      // Route params are untrusted input — check the shape before use.
      const parsed: unknown = JSON.parse(params.lesson);
      return isLessonShape(parsed) ? parsed : null;
    } catch {
      return null;
    }
  });

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    lesson === null ? 'This screen needs a lesson. Open a lesson first.' : '',
  );
  const scrollViewRef = useRef<ScrollView>(null);

  // Keep the newest message in view whenever the conversation grows.
  useEffect(() => {
    if (messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  /** Send one question and append the turn pair on success. On failure the
   *  input keeps its text so the user can simply press send again. */
  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (question === '' || sending || lesson === null) return;
      setSending(true);
      setErrorMessage('');
      try {
        const history: TutorMessage[] = messages.map((turn) => ({
          role: turn.role,
          content: turn.content,
        }));
        const res = await api.tutorChat({
          lesson_id: lesson.id,
          // The backend caps lesson_context at 5000 characters.
          lesson_context: lessonToContext(lesson).slice(0, MAX_CONTEXT_LENGTH),
          messages: history,
          question,
        });
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: question },
          {
            role: 'assistant',
            content: res.answer,
            references: res.references,
            suggestions: res.follow_up_suggestions,
          },
        ]);
        setInput('');
      } catch (e) {
        setErrorMessage(
          e instanceof ApiError && e.status !== 0
            ? e.message
            : 'Tutor unavailable. Check your connection and try again.',
        );
      } finally {
        setSending(false);
      }
    },
    [sending, lesson, messages],
  );

  if (lesson === null) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Tutor' }} />
        <ThemedText type="subtitle" style={styles.centeredText}>
          No lesson to discuss
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {errorMessage}
        </ThemedText>
        <Pressable
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.buttonText}>
            Go to Discover
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const lastSuggestions = [...messages].reverse().find((turn) => turn.role === 'assistant')
    ?.suggestions;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Tutor' }} />
      <ScrollView
        ref={scrollViewRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled">
        <ThemedText type="small" themeColor="textSecondary" style={styles.contextLine}>
          Asking about: {lesson.title}
        </ThemedText>

        {messages.length === 0 && (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText type="subtitle" style={styles.centeredText}>
              Ask the tutor
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centeredText}>
              Questions about this lesson are answered using its content — try something like “Can
              you explain the main idea more simply?”
            </ThemedText>
          </ThemedView>
        )}

        {messages.map((turn, i) =>
          turn.role === 'user' ? (
            <ThemedView key={i} type="backgroundSelected" style={styles.userBubble}>
              <ThemedText>{turn.content}</ThemedText>
            </ThemedView>
          ) : (
            <ThemedView key={i} type="backgroundElement" style={styles.tutorBubble}>
              <MarkdownText markdown={turn.content} />

              {turn.references && turn.references.length > 0 && (
                <View style={styles.references}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Sources
                  </ThemedText>
                  {turn.references.map((ref, j) => (
                    <View key={j}>
                      {/* Only plain http(s) sources are tappable. */}
                      {isSafeWebUrl(ref.url) ? (
                        <Pressable
                          onPress={() => Linking.openURL(ref.url)}
                          style={({ pressed }) => pressed && styles.pressed}>
                          <ThemedText type="linkPrimary">{ref.title}</ThemedText>
                        </Pressable>
                      ) : (
                        <ThemedText>{ref.title}</ThemedText>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </ThemedView>
          ),
        )}

        {/* Tappable follow-up ideas from the latest answer */}
        {messages.length > 0 && lastSuggestions && lastSuggestions.length > 0 && (
          <View style={styles.suggestions}>
            <ThemedText type="small" themeColor="textSecondary">
              Follow-up ideas
            </ThemedText>
            <View style={styles.suggestionChips}>
              {lastSuggestions.map((suggestion, i) => (
                <Pressable
                  key={i}
                  // Fill the composer instead of sending right away, so the
                  // user stays in control of every request.
                  onPress={() => setInput(suggestion)}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small">{suggestion}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {sending && (
          <View style={styles.thinkingRow}>
            <ActivityIndicator size="small" />
            <ThemedText type="small" themeColor="textSecondary">
              The tutor is thinking…
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {errorMessage !== '' && (
        <ThemedText type="small" style={styles.errorText}>
          {errorMessage}
        </ThemedText>
      )}

      {/* Composer */}
      <View style={[styles.composer, { borderTopColor: theme.backgroundSelected }]}>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Ask a question about this lesson…"
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={MAX_QUESTION_LENGTH}
          value={input}
          onChangeText={setInput}
          editable={!sending}
          accessibilityLabel="Your question for the tutor"
        />
        <Pressable
          onPress={() => void send(input)}
          disabled={input.trim() === '' || sending}
          accessibilityRole="button"
          accessibilityLabel="Send question to tutor"
          style={({ pressed }) => [
            styles.sendButton,
            (input.trim() === '' || sending) && styles.sendButtonDisabled,
            pressed && styles.pressed,
          ]}>
          {sending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ThemedText type="smallBold" style={styles.buttonText}>
              Send
            </ThemedText>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
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
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  contextLine: {
    textAlign: 'center',
  },
  emptyCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  userBubble: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  tutorBubble: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    alignSelf: 'flex-start',
    maxWidth: '95%',
  },
  references: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  suggestions: {
    gap: Spacing.one,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    minHeight: 36,
    justifyContent: 'center',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: 1,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    minHeight: 48,
    minWidth: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
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
    marginTop: Spacing.two,
  },
  buttonText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.7,
  },
});

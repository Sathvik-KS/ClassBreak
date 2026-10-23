import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { saveLessonIfMissing, updateReview } from '@/services/lessonStore';
import type { Lesson, QuizQuestion } from '@/types';
import { PASS_SCORE, averageScore, isLessonShape, lessonToContext } from '@/utils/helpers';

const QUESTION_COUNT = 5;

type QuizStatus = 'loading' | 'ready' | 'error';

/** Quiz screen.
 *
 * The lesson is passed as a JSON string in the `lesson` route param (simple
 * and dependency-free; on Android the navigation state is in-memory, so the
 * size is not a problem). Quiz questions come from POST /api/lessons/quiz.
 * Multiple-choice answers are checked locally against `correct_answer`;
 * open-ended answers are graded by POST /api/lessons/evaluate. */
export default function QuizScreen() {
  const params = useLocalSearchParams<{ lesson?: string }>();
  const theme = useTheme();
  // Secondary (non-accent) buttons must follow the theme background or
  // their label becomes unreadable in dark mode.
  const secondaryButtonStyle = [
    styles.secondaryButton,
    { backgroundColor: theme.backgroundSelected },
  ];

  // Parse the lesson once. If the param is missing or malformed we show an
  // error screen instead of crashing. Route params are untrusted input
  // (any app could deep-link here), so the shape is checked at runtime.
  const [lesson] = useState<Lesson | null>(() => {
    if (typeof params.lesson !== 'string') return null;
    try {
      const parsed: unknown = JSON.parse(params.lesson);
      return isLessonShape(parsed) ? parsed : null;
    } catch {
      return null;
    }
  });

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  // A missing/malformed lesson can be detected synchronously, so the initial
  // status is derived rather than set inside an effect.
  const [status, setStatus] = useState<QuizStatus>(lesson === null ? 'error' : 'loading');
  const [errorMessage, setErrorMessage] = useState(
    lesson === null ? 'This quiz needs a lesson. Open a lesson first.' : '',
  );

  // Per-question progress.
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [openAnswer, setOpenAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  // In-quiz error banner (e.g. a failed evaluation) — keeps quiz state.
  const [quizError, setQuizError] = useState<string | null>(null);
  // Storage failure while recording the result (shown on the results screen).
  const [reviewError, setReviewError] = useState('');

  // Loads quiz questions for a lesson. Used by the mount effect and by the
  // "Try again" button. setState only happens inside .then/.catch
  // callbacks (never synchronously), which keeps the mount effect
  // compliant with the react-hooks/set-state-in-effect rule.
  const loadQuestions = useCallback(
    (lessonParam: Lesson) =>
      api
        .generateQuiz({
          lesson_content: lessonToContext(lessonParam),
          topic: lessonParam.topic,
          difficulty: lessonParam.difficulty,
          count: QUESTION_COUNT,
        })
        .then((res) => {
          if (res.questions.length === 0) {
            setErrorMessage('The AI returned no questions for this lesson. Try again.');
            setStatus('error');
            return;
          }
          setQuestions(res.questions);
          setStatus('ready');
        })
        .catch((e: unknown) => {
          // Show server messages (e.g. 429) verbatim; add a connection hint
          // only when the request never reached the server.
          setErrorMessage(
            e instanceof ApiError && e.status !== 0
              ? e.message
              : 'Could not generate quiz questions. Check your connection.',
          );
          setStatus('error');
        }),
    [],
  );

  // Mount load. The initial status is already 'loading' when a lesson
  // param is present, so only loadQuestions' own states are needed.
  // `lesson` is read-only state set once on mount, so this effect still
  // runs only on mount — listing it just satisfies the lint rule.
  useEffect(() => {
    if (!lesson) return;
    loadQuestions(lesson);
  }, [lesson, loadQuestions]);

  const currentQuestion = questions[currentIndex];
  const isMultipleChoice =
    currentQuestion !== undefined &&
    currentQuestion.question_type !== 'open_ended' &&
    currentQuestion.options.length > 0;
  const isLastQuestion = currentIndex + 1 >= questions.length;

  const checkMultipleChoice = useCallback(() => {
    // `revealed` guard: a fast double-tap before the button re-renders as
    // disabled must not record the score twice.
    if (!selected || !currentQuestion || revealed) return;
    const correct = selected === currentQuestion.correct_answer;
    setScores((prev) => [...prev, correct ? 1 : 0]);
    setFeedback(
      correct
        ? 'Correct!'
        : `Not quite — the answer is "${currentQuestion.correct_answer}".`,
    );
    setRevealed(true);
  }, [selected, currentQuestion, revealed]);

  const submitOpenAnswer = useCallback(async () => {
    if (!currentQuestion || !openAnswer.trim() || evaluating) return;
    setEvaluating(true);
    setQuizError(null);
    try {
      const res = await api.evaluateAnswer({
        question: currentQuestion.question,
        correct_answer: currentQuestion.correct_answer,
        user_answer: openAnswer.trim(),
        question_type: 'open_ended',
      });
      setScores((prev) => [...prev, res.score]);
      setFeedback(res.feedback);
      setRevealed(true);
    } catch (e) {
      // Shown as an in-quiz banner: without it a failed submission would
      // leave the user staring at an unchanged form.
      setQuizError(
        e instanceof ApiError && e.status !== 0
          ? e.message
          : 'Evaluation failed — check your connection and try again.',
      );
    } finally {
      setEvaluating(false);
    }
  }, [currentQuestion, openAnswer, evaluating]);

  /** Store the finished quiz: save the lesson (so it can be reviewed
   *  later) and advance its review schedule. Called once when the last
   *  question is completed. */
  const recordResult = useCallback(async () => {
    if (!lesson) return;
    try {
      const passed = averageScore(scores) >= PASS_SCORE;
      await saveLessonIfMissing(lesson);
      await updateReview(lesson.id, passed);
      setReviewError('');
    } catch {
      setReviewError('Could not save your review schedule on this device.');
    }
  }, [lesson, scores]);

  const goToNextQuestion = useCallback(() => {
    if (isLastQuestion) {
      setFinished(true);
      // Record the outcome like the web app: keep the lesson (if new) and
      // advance its spaced-review schedule. Storage failure is reported on
      // the results screen without blocking it.
      void recordResult();
      return;
    }
    setSelected(null);
    setRevealed(false);
    setOpenAnswer('');
    setFeedback(null);
    setQuizError(null);
    setCurrentIndex((i) => i + 1);
  }, [isLastQuestion, recordResult]);

  // ----- Non-quiz screens -------------------------------------------------

  if (status === 'loading') {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          Preparing your quiz…
        </ThemedText>
      </ThemedView>
    );
  }

  if (status === 'error') {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Quiz' }} />
        <ThemedText type="subtitle" style={styles.centeredText}>
          Quiz unavailable
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {errorMessage}
        </ThemedText>
        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.buttonText}>
              Back to lesson
            </ThemedText>
          </Pressable>
          {lesson && (
            <Pressable
              onPress={() => {
                // Event handler: showing the loading state again is fine here.
                setStatus('loading');
                setErrorMessage('');
                loadQuestions(lesson);
              }}
              style={({ pressed }) => [secondaryButtonStyle, pressed && styles.pressed]}>
              <ThemedText type="smallBold">Try again</ThemedText>
            </Pressable>
          )}
        </View>
      </ThemedView>
    );
  }

  if (finished) {
    const score = averageScore(scores);
    const percent = Math.round(score * 100);
    const passed = score >= PASS_SCORE;
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Results' }} />
        <ThemedText type="subtitle" style={styles.centeredText}>
          {passed ? 'Nicely done!' : 'Good effort!'}
        </ThemedText>
        <ThemedText style={styles.scoreText}>{percent}%</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {passed
            ? 'Your next review is scheduled further out.'
            : 'This lesson will come back sooner for another pass.'}
        </ThemedText>
        {reviewError !== '' && (
          <ThemedText type="small" style={styles.reviewErrorText}>
            {reviewError}
          </ThemedText>
        )}
        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.buttonText}>
              Back to lesson
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/')}
            style={({ pressed }) => [secondaryButtonStyle, pressed && styles.pressed]}>
            <ThemedText type="smallBold">Discover</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  // ----- Active question --------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: `Question ${currentIndex + 1}/${questions.length}` }} />

        {/* Progress */}
        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentIndex / questions.length) * 100}%` },
            ]}
          />
        </View>

        {quizError && (
          <ThemedView type="backgroundSelected" style={styles.errorBanner}>
            <ThemedText type="small" style={styles.errorText}>
              {quizError}
            </ThemedText>
          </ThemedView>
        )}

        <ThemedView type="backgroundElement" style={styles.questionCard}>
          <MarkdownText markdown={currentQuestion.question} />

          {isMultipleChoice ? (
            <>
              {currentQuestion.options.map((option, i) => {
                let optionStyle: object[] = [
                  styles.option,
                  { borderColor: theme.backgroundSelected },
                ];
                let textColor;
                if (revealed && option === currentQuestion.correct_answer) {
                  optionStyle.push(styles.optionCorrect);
                  textColor = styles.optionCorrectText;
                } else if (revealed && option === selected) {
                  optionStyle.push(styles.optionWrong);
                  textColor = styles.optionWrongText;
                } else if (selected === option) {
                  optionStyle.push(styles.optionSelected);
                  // The selected chip always uses a light background, so it
                  // needs explicit dark text to stay readable in dark mode.
                  textColor = styles.optionSelectedText;
                }
                return (
                  <Pressable
                    key={i}
                    onPress={() => setSelected(option)}
                    disabled={revealed}
                    style={({ pressed }) => [optionStyle, pressed && !revealed && styles.pressed]}>
                    <ThemedText style={textColor}>
                      {revealed && option === currentQuestion.correct_answer ? '✓ ' : ''}
                      {revealed && option === selected && option !== currentQuestion.correct_answer
                        ? '✗ '
                        : ''}
                      {option}
                    </ThemedText>
                  </Pressable>
                );
              })}

              {!revealed ? (
                <Pressable
                  onPress={checkMultipleChoice}
                  disabled={!selected}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !selected && styles.buttonDisabled,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={styles.buttonText}>
                    Check answer
                  </ThemedText>
                </Pressable>
              ) : (
                <>
                  {feedback && (
                    <ThemedText type="smallBold" style={styles.feedback}>
                      {feedback}
                    </ThemedText>
                  )}
                  {currentQuestion.explanation !== '' && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {currentQuestion.explanation}
                    </ThemedText>
                  )}
                  <Pressable
                    onPress={goToNextQuestion}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      {isLastQuestion ? 'See results' : 'Next question'}
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </>
          ) : (
            <>
              <TextInput
                style={[styles.textInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="Type your answer…"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                value={openAnswer}
                onChangeText={setOpenAnswer}
                editable={!revealed && !evaluating}
                accessibilityLabel="Your answer to the open-ended question"
              />
              {!revealed ? (
                <Pressable
                  onPress={submitOpenAnswer}
                  disabled={!openAnswer.trim() || evaluating}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!openAnswer.trim() || evaluating) && styles.buttonDisabled,
                    pressed && styles.pressed,
                  ]}>
                  {evaluating ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      Submit answer
                    </ThemedText>
                  )}
                </Pressable>
              ) : (
                <>
                  {feedback && (
                    <ThemedText type="smallBold" style={styles.feedback}>
                      {feedback}
                    </ThemedText>
                  )}
                  <ThemedText type="small" themeColor="textSecondary">
                    Model answer: {currentQuestion.correct_answer}
                  </ThemedText>
                  <Pressable
                    onPress={goToNextQuestion}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      {isLastQuestion ? 'See results' : 'Next question'}
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  reviewErrorText: {
    color: '#ef4444',
    textAlign: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    // Background color comes from the theme in the JSX.
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#3c87f7',
  },
  questionCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  option: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    // Border color comes from the theme in the JSX.
  },
  optionSelected: {
    borderColor: '#3c87f7',
    backgroundColor: '#EFF6FF',
  },
  optionSelectedText: {
    // Dark text for the always-light selected chip (readable in dark mode).
    color: '#0f172a',
  },
  optionCorrect: {
    borderColor: '#22c55e',
    backgroundColor: '#F0FDF4',
  },
  optionCorrectText: {
    color: '#15803d',
    fontWeight: '700',
  },
  optionWrong: {
    borderColor: '#ef4444',
    backgroundColor: '#FEF2F2',
  },
  optionWrongText: {
    color: '#b91c1c',
  },
  textInput: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  feedback: {
    marginTop: Spacing.one,
  },
  errorBanner: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  errorText: {
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    // Background color comes from the theme in the JSX.
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
  },
  pressed: {
    opacity: 0.7,
  },
});

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Trophy, WifiOff, HelpCircle } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { getSavedLesson } from '../services/lessonStore';
import { useLessons } from '../hooks/useLessons';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { lessonToContext, generateId } from '../utils/helpers';
import { db } from '../db/database';
import { Markdown } from '../components/Markdown';
import type { QuizQuestion, SavedLesson } from '../types';

const QUESTION_COUNT = 5;
const PASS_SCORE = 0.6;

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { updateReview } = useLessons();

  const [lesson, setLesson] = useState<SavedLesson | undefined>();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [openAnswer, setOpenAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const l = await getSavedLesson(id);
      setLesson(l);
      if (!l) { setLoading(false); return; }
      try {
        const res = await api.generateQuiz({
          lesson_content: lessonToContext(l),
          topic: l.topic,
          difficulty: l.difficulty,
          count: QUESTION_COUNT,
        });
        setQuestions(res.questions);
      } catch (e) {
        // Surface server messages (e.g. 429 rate limit) verbatim; fall back to
        // a connection hint only when the request never reached the server.
        setError(
          e instanceof ApiError && e.status !== 0
            ? e.message
            : 'Could not generate quiz questions. Check your connection and try again.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const finish = useCallback(async (finalScores: number[]) => {
    if (!lesson) return;
    const score = finalScores.length
      ? finalScores.reduce((a, b) => a + b, 0) / finalScores.length
      : 0;
    await db.quizAttempts.put({
      id: generateId(),
      lessonId: lesson.id,
      questions,
      answers: [],
      score,
      completedAt: new Date().toISOString(),
      synced: false,
    });
    await updateReview(lesson.id, score >= PASS_SCORE);
    setFinished(true);
  }, [lesson, questions, updateReview]);

  const checkMc = () => {
    if (!selected) return;
    const q = questions[currentIndex];
    const correct = selected === q.correct_answer;
    setRevealed(true);
    setScores(prev => [...prev, correct ? 1 : 0]);
    setFeedback(correct ? 'Correct!' : `Not quite — the answer is “${q.correct_answer}”.`);
  };

  const submitOpen = async () => {
    const q = questions[currentIndex];
    if (!openAnswer.trim()) return;
    setEvaluating(true);
    setError(null); // clear any previous failure so a retry gives fresh feedback
    try {
      const res = await api.evaluateAnswer({
        question: q.question,
        correct_answer: q.correct_answer,
        user_answer: openAnswer.trim(),
        question_type: 'open_ended',
      });
      setScores(prev => [...prev, res.score]);
      setFeedback(res.feedback);
      setRevealed(true);
    } catch (e) {
      // Shown in the in-quiz banner below — without it the failed submission
      // would leave the user staring at an unchanged form.
      setError(
        e instanceof ApiError && e.status !== 0
          ? e.message
          : 'Evaluation failed — check your connection.',
      );
    } finally {
      setEvaluating(false);
    }
  };

  const next = () => {
    const finalScores = scores;
    setSelected(null);
    setRevealed(false);
    setOpenAnswer('');
    setFeedback(null);
    if (currentIndex + 1 >= questions.length) {
      void finish(finalScores);
    } else {
      setCurrentIndex(i => i + 1);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="card skeleton-card"><Loader2 size={20} className="spin" /> Preparing your quiz…</div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="page">
        <div className="empty-state">
          <HelpCircle size={36} className="muted-icon" />
          <h2>Lesson not found</h2>
          <Link className="btn btn-primary" to="/">Back to Discover</Link>
        </div>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          {isOnline ? <HelpCircle size={36} className="muted-icon" /> : <WifiOff size={36} className="muted-icon" />}
          <h2>{isOnline ? 'Quiz unavailable' : "You're offline"}</h2>
          <p>{error}</p>
          <Link className="btn btn-secondary" to={`/lesson/${lesson.id}`}>Back to lesson</Link>
        </div>
      </div>
    );
  }

  if (finished) {
    const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const pct = Math.round(score * 100);
    return (
      <div className="page">
        <div className="card result-card">
          <Trophy size={36} className={score >= PASS_SCORE ? 'gold' : 'muted-icon'} />
          <h2>{score >= PASS_SCORE ? 'Nicely done!' : 'Good effort!'}</h2>
          <p className="score">{pct}%</p>
          <p className="muted">
            {score >= PASS_SCORE
              ? 'Your next review is scheduled further out.'
              : 'This lesson will come back sooner for another pass.'}
          </p>
          <div className="action-bar">
            <Link className="btn btn-primary" to={`/lesson/${lesson.id}`}>Re-read lesson</Link>
            <Link className="btn btn-ghost" to="/review">Go to Review</Link>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];
  const isMc = q.question_type !== 'open_ended' && q.options.length > 0;

  return (
    <div className="page">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="quiz-progress">
        <span>Question {currentIndex + 1} of {questions.length}</span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(currentIndex / questions.length) * 100}%` }} />
        </div>
      </div>

      {error && (
        <div className="banner banner-error" role="alert">{error}</div>
      )}

      <div className="card quiz-card">
        <Markdown source={q.question} />

        {isMc ? (
          <>
            <div className="options">
              {q.options.map((opt, i) => {
                let cls = 'option';
                if (revealed && opt === q.correct_answer) cls += ' correct';
                else if (revealed && opt === selected) cls += ' wrong';
                else if (selected === opt) cls += ' selected';
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => setSelected(opt)}
                    disabled={revealed}
                  >
                    {revealed && opt === q.correct_answer && <CheckCircle2 size={16} />}
                    {revealed && opt === selected && opt !== q.correct_answer && <XCircle size={16} />}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {!revealed ? (
              <button className="btn btn-primary btn-block" onClick={checkMc} disabled={!selected}>
                Check answer
              </button>
            ) : (
              <>
                {feedback && <p className="feedback">{feedback}</p>}
                {q.explanation && <p className="muted explanation">{q.explanation}</p>}
                <button className="btn btn-primary btn-block" onClick={next}>
                  {currentIndex + 1 >= questions.length ? 'See results' : 'Next question'}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <textarea
              className="textarea"
              rows={4}
              placeholder="Type your answer…"
              aria-label="Your answer to the open-ended question"
              value={openAnswer}
              onChange={e => setOpenAnswer(e.target.value)}
              disabled={revealed}
            />
            {!revealed ? (
              <button className="btn btn-primary btn-block" onClick={() => void submitOpen()} disabled={!openAnswer.trim() || evaluating}>
                {evaluating ? <Loader2 size={16} className="spin" /> : null} Submit answer
              </button>
            ) : (
              <>
                {feedback && <p className="feedback">{feedback}</p>}
                <p className="muted">Model answer: {q.correct_answer}</p>
                <button className="btn btn-primary btn-block" onClick={next}>
                  {currentIndex + 1 >= questions.length ? 'See results' : 'Next question'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

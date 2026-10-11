import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpenCheck, Download, MessageCircleQuestion, ListChecks,
  Trash2, WifiOff, Loader2, HelpCircle,
} from 'lucide-react';
import { setLessonDownloaded, deleteLessonAndData, getSavedLesson } from '../services/lessonStore';
import { generateAndSaveLesson } from '../services/generateLesson';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getDomainColor, getDifficultyColor } from '../utils/helpers';
import { Markdown } from '../components/Markdown';
import type { SavedLesson } from '../types';

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const [lesson, setLesson] = useState<SavedLesson | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [generatingRelated, setGeneratingRelated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSavedLesson(id ?? '').then(l => {
      if (!cancelled) {
        setLesson(l);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  const toggleDownload = async () => {
    if (!lesson) return;
    await setLessonDownloaded(lesson.id, !lesson.isDownloaded);
    setRefreshKey(k => k + 1);
  };

  const removeLesson = async () => {
    if (!lesson || !window.confirm('Delete this lesson from your library?')) return;
    await deleteLessonAndData(lesson.id);
    navigate('/saved');
  };

  const openRelated = async (topic: string) => {
    setGeneratingRelated(topic);
    setError(null);
    try {
      const next = await generateAndSaveLesson(topic, 5, 'beginner');
      navigate(`/lesson/${next.id}`);
    } catch {
      setError('Could not generate a lesson on that topic right now.');
    } finally {
      setGeneratingRelated(null);
    }
  };

  if (!loaded) {
    return (
      <div className="page">
        <div className="card skeleton-card"><Loader2 size={20} className="spin" /> Loading…</div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="page">
        <div className="empty-state">
          <HelpCircle size={36} className="muted-icon" />
          <h2>Lesson not found</h2>
          <p>It may have been deleted. Explore something new instead.</p>
          <Link className="btn btn-primary" to="/">Back to Discover</Link>
        </div>
      </div>
    );
  }

  const offlineUnavailable = !isOnline && !lesson.isDownloaded;

  return (
    <div className="page lesson-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="chip-row">
        <span className={`chip ${getDomainColor(lesson.domain)}`}>{lesson.domain}</span>
        <span className={`chip ${getDifficultyColor(lesson.difficulty)}`}>{lesson.difficulty}</span>
        <span className="chip chip-plain">{lesson.duration_minutes} min read</span>
        {lesson.isDownloaded && <span className="chip chip-download"><Download size={12} /> Offline</span>}
      </div>

      <h1 className="lesson-title">{lesson.title}</h1>
      <p className="lesson-summary">{lesson.summary}</p>

      {offlineUnavailable && (
        <div className="banner banner-error">
          <WifiOff size={16} /> You're offline and this lesson isn't downloaded. Quiz and tutor also need a connection.
        </div>
      )}
      {error && <div className="banner banner-error">{error}</div>}

      {lesson.sections.map((section, i) => (
        <section key={i} className="card lesson-section">
          <h3>{section.heading}</h3>
          <Markdown source={section.content} />
          {section.key_points.length > 0 && (
            <ul className="key-points">
              {section.key_points.map((kp, j) => (
                <li key={j}>{kp}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {lesson.examples.length > 0 && (
        <section className="card">
          <h3><BookOpenCheck size={17} /> Examples in the wild</h3>
          {lesson.examples.map((ex, i) => (
            <p key={i} className="example">{ex}</p>
          ))}
        </section>
      )}

      {lesson.takeaways.length > 0 && (
        <section className="card takeaways">
          <h3>Key takeaways</h3>
          <ul>
            {lesson.takeaways.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {lesson.references.length > 0 && (
        <section className="card">
          <h3>Sources</h3>
          <ul className="refs">
            {lesson.references.map((ref, i) => (
              <li key={i}>
                <a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.title}</a>
                <span className="muted"> · {ref.source_type}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lesson.related_topics.length > 0 && (
        <section className="card">
          <h3>Explore deeper</h3>
          <div className="chip-row wrap">
            {lesson.related_topics.map((topic, i) => (
              <button
                key={i}
                className="chip chip-action"
                onClick={() => void openRelated(topic)}
                disabled={generatingRelated !== null || !isOnline}
              >
                {generatingRelated === topic ? <Loader2 size={12} className="spin" /> : null}
                {topic}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="action-bar">
        <button className="btn btn-primary" onClick={() => navigate(`/quiz/${lesson.id}`)} disabled={offlineUnavailable}>
          <ListChecks size={16} /> Quiz me
        </button>
        <button className="btn btn-secondary" onClick={() => navigate(`/tutor/${lesson.id}`)} disabled={offlineUnavailable}>
          <MessageCircleQuestion size={16} /> Ask tutor
        </button>
      </div>
      <div className="action-bar">
        <button className="btn btn-ghost" onClick={() => void toggleDownload()}>
          <Download size={16} /> {lesson.isDownloaded ? 'Remove download' : 'Download for offline'}
        </button>
        <button className="btn btn-danger-ghost" onClick={() => void removeLesson()}>
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </div>
  );
}

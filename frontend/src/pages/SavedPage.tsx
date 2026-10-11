import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Download, Trash2, Bookmark, Clock } from 'lucide-react';
import { useLessons } from '../hooks/useLessons';
import { setLessonDownloaded, deleteLessonAndData } from '../services/lessonStore';
import { formatDate, getDomainColor } from '../utils/helpers';

export default function SavedPage() {
  const navigate = useNavigate();
  const { savedLessons } = useLessons();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Saved</h1>
          <p className="muted">Your library — downloaded lessons work offline</p>
        </div>
      </div>

      {savedLessons.length === 0 && (
        <div className="empty-state">
          <Bookmark size={36} className="muted-icon" />
          <h2>Nothing saved yet</h2>
          <p>Lessons you open from Discover are saved here automatically.</p>
          <Link className="btn btn-primary" to="/">Discover something</Link>
        </div>
      )}

      <div className="feed">
        {savedLessons.map(lesson => (
          <article key={lesson.id} className="card feed-card">
            <div className="chip-row">
              <span className={`chip ${getDomainColor(lesson.domain)}`}>{lesson.domain}</span>
              {lesson.isDownloaded && <span className="chip chip-download"><Download size={12} /> Offline</span>}
            </div>
            <h2>
              <Link to={`/lesson/${lesson.id}`} className="card-title-link">{lesson.title}</Link>
            </h2>
            <p className="muted small"><Clock size={12} /> Saved {formatDate(lesson.savedAt)} · {lesson.duration_minutes} min</p>
            <div className="card-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/lesson/${lesson.id}`)}>
                <BookOpen size={14} /> Read
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => void setLessonDownloaded(lesson.id, !lesson.isDownloaded)}>
                <Download size={14} /> {lesson.isDownloaded ? 'Remove download' : 'Download'}
              </button>
              <button className="btn btn-danger-ghost btn-sm" onClick={() => {
                if (window.confirm('Delete this lesson?')) void deleteLessonAndData(lesson.id);
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RotateCcw, CheckCircle2, XCircle, CalendarClock, PartyPopper } from 'lucide-react';
import { useLessons } from '../hooks/useLessons';
import { getDomainColor, formatDate } from '../utils/helpers';

export default function ReviewPage() {
  const navigate = useNavigate();
  const { savedLessons, reviewItems, updateReview, getDueReviews } = useLessons();

  const due = getDueReviews();
  const lessonById = useMemo(
    () => new Map(savedLessons.map(l => [l.id, l])),
    [savedLessons],
  );
  const dueWithLessons = due
    .map(item => ({ item, lesson: lessonById.get(item.lessonId) }))
    .filter(d => d.lesson !== undefined);
  const upcomingCount = reviewItems.length - due.length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Review</h1>
          <p className="muted">Spaced repetition keeps learning sticky</p>
        </div>
      </div>

      {dueWithLessons.length === 0 && (
        <div className="empty-state">
          <PartyPopper size={36} className="muted-icon" />
          <h2>All caught up</h2>
          <p>
            {upcomingCount > 0
              ? `${upcomingCount} lesson${upcomingCount === 1 ? '' : 's'} scheduled for later.`
              : 'Take a quiz after reading a lesson to schedule reviews.'}
          </p>
          <Link className="btn btn-ghost" to="/saved">Browse saved lessons</Link>
        </div>
      )}

      {dueWithLessons.map(({ item, lesson }) => (
        <article key={item.id} className="card feed-card">
          <div className="chip-row">
            <span className={`chip ${getDomainColor(lesson!.domain)}`}>{lesson!.domain}</span>
            <span className="chip chip-plain"><CalendarClock size={12} /> Due {formatDate(item.nextReviewAt)}</span>
          </div>
          <h2>
            <Link to={`/lesson/${lesson!.id}`} className="card-title-link">{lesson!.title}</Link>
          </h2>
          <p className="muted small">How well do you remember this?</p>
          <div className="card-actions">
            <button className="btn btn-primary btn-sm" onClick={() => { void updateReview(item.lessonId, true); }}>
              <CheckCircle2 size={14} /> Remembered it
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { void updateReview(item.lessonId, false); }}>
              <XCircle size={14} /> Need another pass
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/lesson/${lesson!.id}`)}>
              <RotateCcw size={14} /> Re-read
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, Sparkles, Loader2, Compass } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { generateAndSaveLesson } from '../services/generateLesson';
import { recordFeedShown, recentFeedHistoryIds } from '../services/lessonStore';
import { usePreferences } from '../hooks/usePreferences';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getDomainColor, getDifficultyColor } from '../utils/helpers';
import type { FeedItem } from '../types';

export default function DiscoverPage() {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { preferences } = usePreferences();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const historyIds = await recentFeedHistoryIds(20);
      const res = await api.discoverFeed({
        interests: preferences.interests,
        excluded_topics: preferences.excludedTopics,
        history_ids: historyIds,
        count: 10,
      });
      setItems(res.items);
      await recordFeedShown(res.items);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setError('Cannot reach the ClassBreak backend. Start it (see README) and try again.');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load feed');
      }
    } finally {
      setLoading(false);
    }
  }, [preferences.interests, preferences.excludedTopics]);

  useEffect(() => {
    void loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLearn = async (item: FeedItem) => {
    setGeneratingTopic(item.topic);
    setError(null);
    try {
      const lesson = await generateAndSaveLesson(
        item.topic,
        preferences.defaultDuration,
        item.difficulty,
      );
      navigate(`/lesson/${lesson.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 0
          ? 'Cannot reach the backend to generate this lesson.'
          : e instanceof ApiError && e.status === 429
            ? e.message // surface the rate-limit message instead of a misleading hint
            : 'Could not generate this lesson. Try another topic.',
      );
    } finally {
      setGeneratingTopic(null);
    }
  };

  if (!isOnline && items.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <Compass size={36} className="muted-icon" />
          <h2>You're offline</h2>
          <p>Discovery needs a connection. Your <Link to="/saved">downloaded lessons</Link> are still readable.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Discover</h1>
          <p className="muted">Something intriguing for your next break</p>
        </div>
        <button className="icon-btn" onClick={() => void loadFeed()} disabled={loading} aria-label="Refresh feed">
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {error && <div className="banner banner-error">{error}</div>}
      {preferences.interests.length === 0 && (
        <div className="banner banner-info">
          Tip: pick your interests in <Link to="/settings">Settings</Link> to personalize the feed.
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="card skeleton-card">
          <Loader2 size={20} className="spin" /> <span>Thinking of interesting things…</span>
        </div>
      )}

      <div className="feed">
        {items.map(item => (
          <article key={item.id} className="card feed-card">
            <div className="chip-row">
              <span className={`chip ${getDomainColor(item.domain)}`}>{item.domain}</span>
              <span className={`chip ${getDifficultyColor(item.difficulty)}`}>{item.difficulty}</span>
              <span className="chip chip-plain">{item.estimated_minutes} min</span>
            </div>
            <h2>{item.title}</h2>
            <p className="hook">{item.hook}</p>
            <button
              className="btn btn-primary"
              onClick={() => void handleLearn(item)}
              disabled={generatingTopic !== null}
            >
              {generatingTopic === item.topic ? (
                <>
                  <Loader2 size={16} className="spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Learn this
                </>
              )}
            </button>
          </article>
        ))}
      </div>

      {items.length > 0 && (
        <button className="btn btn-ghost btn-block" onClick={() => void loadFeed()} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Show me more
        </button>
      )}
    </div>
  );
}

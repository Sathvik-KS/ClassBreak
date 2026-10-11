import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, WifiOff, HelpCircle, User, Sparkles } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { getSavedLesson } from '../services/lessonStore';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { lessonToContext } from '../utils/helpers';
import { Markdown } from '../components/Markdown';
import type { SavedLesson, TutorMessage } from '../types';

interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

export default function TutorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const [lesson, setLesson] = useState<SavedLesson | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLesson(await getSavedLesson(id));
      setLoaded(true);
    })();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || sending || !lesson) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setSending(true);
    try {
      const history: TutorMessage[] = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await api.tutorChat({
        lesson_context: lessonToContext(lesson),
        messages: history.slice(-10),
        question: trimmed,
      });
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: res.answer, suggestions: res.follow_up_suggestions },
      ]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content:
            e instanceof ApiError && e.status === 0
              ? "I can't reach the tutor service right now — check your connection."
              : 'Something went wrong answering that. Try again?',
        },
      ]);
    } finally {
      setSending(false);
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
          <Link className="btn btn-primary" to="/">Back to Discover</Link>
        </div>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="page">
        <button className="back-link" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>
        <div className="empty-state">
          <WifiOff size={36} className="muted-icon" />
          <h2>Tutor needs a connection</h2>
          <p>You can still re-read “{lesson.title}” offline from your Saved lessons.</p>
          <Link className="btn btn-secondary" to={`/lesson/${lesson.id}`}>Back to lesson</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page tutor-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="tutor-title"><Sparkles size={18} /> Tutor · {lesson.title}</h1>

      <div className="chat">
        <div className="bubble assistant intro">
          Ask me anything about this lesson — deeper explanations, analogies, or real-world connections.
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`bubble-row ${m.role}`}>
            <span className="avatar">{m.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}</span>
            <div className={`bubble ${m.role}`}>
              {m.role === 'assistant' ? <Markdown source={m.content} /> : <p>{m.content}</p>}
            </div>
          </div>
        ))}
        {sending && (
          <div className="bubble-row assistant">
            <span className="avatar"><Sparkles size={14} /></span>
            <div className="bubble assistant"><Loader2 size={16} className="spin" /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length > 0 && !sending && (
        <div className="suggestions">
          {(() => {
            const last = [...messages].reverse().find(m => m.role === 'assistant');
            return last?.suggestions?.slice(0, 3).map((s, i) => (
              <button key={i} className="chip chip-action" onClick={() => void send(s)}>{s}</button>
            ));
          })()}
        </div>
      )}

      <form
        className="composer"
        onSubmit={e => { e.preventDefault(); void send(input); }}
      >
        <input
          className="input"
          type="text"
          placeholder="Ask a follow-up…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={sending}
        />
        <button className="btn btn-primary composer-btn" type="submit" disabled={sending || !input.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

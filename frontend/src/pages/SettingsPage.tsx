import { useEffect, useState } from 'react';
import { Check, Loader2, Server, ShieldCheck } from 'lucide-react';
import { usePreferences } from '../hooks/usePreferences';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { api } from '../services/api';
import { DOMAINS, SESSION_DURATIONS } from '../utils/constants';

type Health = { status: string; ai_provider: string; version: string } | null;

export default function SettingsPage() {
  const { preferences, toggleInterest, setDuration } = usePreferences();
  const isOnline = useOnlineStatus();
  const [health, setHealth] = useState<Health>(null);
  const [healthError, setHealthError] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkBackend = () => {
    setChecking(true);
    setHealthError(false);
    api.health()
      .then(setHealth)
      .catch(() => setHealthError(true))
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    if (isOnline) checkBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Tune ClassBreak to you</p>
        </div>
      </div>

      <section className="card">
        <h3>Interests</h3>
        <p className="muted small">Used to personalize your discovery feed.</p>
        <div className="chip-row wrap">
          {DOMAINS.map(d => {
            const active = preferences.interests.includes(d.id);
            return (
              <button
                key={d.id}
                className={active ? 'chip chip-toggle active' : 'chip chip-toggle'}
                onClick={() => void toggleInterest(d.id)}
              >
                {active ? <Check size={12} /> : null} {d.emoji} {d.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h3>Default lesson length</h3>
        <div className="chip-row wrap">
          {SESSION_DURATIONS.map(d => (
            <button
              key={d.value}
              className={preferences.defaultDuration === d.value ? 'chip chip-toggle active' : 'chip chip-toggle'}
              onClick={() => void setDuration(d.value)}
            >
              {d.label} — {d.description}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3><Server size={17} /> Backend</h3>
        {checking && <p className="muted"><Loader2 size={14} className="spin" /> Checking…</p>}
        {health && (
          <p>
            Connected · version {health.version} · AI provider: <strong>{health.ai_provider}</strong>
            {health.ai_provider === 'mock' && (
              <span className="muted"> (sample content — add a GEMINI_API_KEY in backend/.env for real lessons)</span>
            )}
          </p>
        )}
        {healthError && <p className="muted">Backend unreachable at http://localhost:8000.</p>}
        <button className="btn btn-ghost btn-sm" onClick={checkBackend} disabled={checking || !isOnline}>
          Re-check
        </button>
      </section>

      <section className="card">
        <h3><ShieldCheck size={17} /> Privacy</h3>
        <p className="muted small">
          ClassBreak is guest-first: your interests, saved lessons, quiz history, and review
          schedule live only in this browser (IndexedDB) — never on a server. The backend sees
          only generation requests and keeps no user data.
        </p>
      </section>
    </div>
  );
}

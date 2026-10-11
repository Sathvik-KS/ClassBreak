import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Compass, Bookmark, RotateCcw, Settings, Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import DiscoverPage from './pages/DiscoverPage';
import LessonPage from './pages/LessonPage';
import QuizPage from './pages/QuizPage';
import TutorPage from './pages/TutorPage';
import SavedPage from './pages/SavedPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function ConnectionBadge() {
  const isOnline = useOnlineStatus();
  return (
    <span
      className={isOnline ? 'conn conn-online' : 'conn conn-offline'}
      title={isOnline ? 'Online' : 'Offline — downloaded lessons are still available'}
    >
      {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
    </span>
  );
}

const NAV_ITEMS = [
  { to: '/', label: 'Discover', icon: Compass, end: true },
  { to: '/saved', label: 'Saved', icon: Bookmark, end: false },
  { to: '/review', label: 'Review', icon: RotateCcw, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
] as const;

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <header className="app-header">
        <span className="brand">Class<span>Break</span></span>
        <ConnectionBadge />
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/lesson/:id" element={<LessonPage />} />
          <Route path="/quiz/:id" element={<QuizPage />} />
          <Route path="/tutor/:id" element={<TutorPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </BrowserRouter>
  );
}

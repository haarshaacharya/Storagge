import { useEffect, useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { supabase, type AITool, type Reel, isNewActive } from './lib/supabase';
import Navbar, { type Tab } from './components/Navbar';
import AuthModal from './components/AuthModal';
import AIToolsView from './components/AIToolsView';
import QuickURLsView, { getLatestQuickUrlTime } from './components/QuickURLsView';
import ReelsView from './components/ReelsView';
import ProfileModal from './components/ProfileModal';
import SavedDrawer from './components/SavedDrawer';
import AdminPanel from './components/AdminPanel';
import { Sparkles } from 'lucide-react';

function Hub() {
  const { user, profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('tools');
  const [search, setSearch] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  // notification dots: tracks unseen new tools / new urls / new reels since last view
  const [dots, setDots] = useState({ tools: false, urls: false, reels: false });
  const [seenToolsAt, setSeenToolsAt] = useState<number>(Number(localStorage.getItem('seenToolsAt') || Date.now()));
  const [seenReelsAt, setSeenReelsAt] = useState<number>(Number(localStorage.getItem('seenReelsAt') || Date.now()));

  // Hidden admin entry: via #admin hash. Only the admin profile can actually use it.
  useEffect(() => {
    function checkHash() {
      if (window.location.hash === '#admin') {
        setAdminMode(true);
      }
    }
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // New tools detection for red dot on Tools tab
  useEffect(() => {
    if (adminMode) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('ai_tools')
        .select('created_at, is_new')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!active || !data) return;
      const hasNew = (data as AITool[]).some(
        (t) => isNewActive(t.created_at, t.is_new) && new Date(t.created_at).getTime() > seenToolsAt
      );
      setDots((d) => ({ ...d, tools: hasNew }));
    })();
    return () => { active = false; };
  }, [seenToolsAt, adminMode]);

  // New reels detection for red dot on Reels tab
  useEffect(() => {
    if (adminMode) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('reels')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);
      if (!active || !data || data.length === 0) return;
      const newest = new Date((data as Reel[])[0].created_at).getTime();
      setDots((d) => ({ ...d, reels: newest > seenReelsAt }));
    })();
    return () => { active = false; };
  }, [seenReelsAt, adminMode]);

  // Quick URLs dot: new since last visit (user-scoped, localStorage)
  useEffect(() => {
    if (adminMode || !user) { setDots((d) => ({ ...d, urls: false })); return; }
    const seenUrlsAt = Number(localStorage.getItem('seenUrlsAt') || Date.now());
    const latest = getLatestQuickUrlTime(user.id);
    setDots((d) => ({ ...d, urls: latest > seenUrlsAt }));
  }, [user, adminMode]);

  const onTab = useCallback((t: Tab) => {
    setTab(t);
    // clear dot when visiting
    if (t === 'tools') {
      const now = Date.now();
      setSeenToolsAt(now);
      localStorage.setItem('seenToolsAt', String(now));
      setDots((d) => ({ ...d, tools: false }));
    } else if (t === 'reels') {
      const now = Date.now();
      setSeenReelsAt(now);
      localStorage.setItem('seenReelsAt', String(now));
      setDots((d) => ({ ...d, reels: false }));
    } else if (t === 'urls') {
      const now = Date.now();
      localStorage.setItem('seenUrlsAt', String(now));
      setDots((d) => ({ ...d, urls: false }));
    }
  }, []);

  if (adminMode) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <AdminPanel
        onExit={() => {
          setAdminMode(false);
          if (window.location.hash === '#admin') {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar
        tab={tab}
        onTab={onTab}
        search={search}
        onSearch={setSearch}
        onOpenAuth={() => setShowAuth(true)}
        onOpenProfile={() => { setViewProfileId(null); setShowProfile(true); }}
        onOpenSaved={() => setShowSaved(true)}
        dots={dots}
      />

      <main className="w-full px-4 py-6">
        {tab === 'tools' && <AIToolsView search={search} />}
        {tab === 'urls' && <QuickURLsView onOpenAuth={() => setShowAuth(true)} />}
        {tab === 'reels' && <ReelsView onOpenAuth={() => setShowAuth(true)} onOpenProfile={(p) => { setViewProfileId(p.id); setShowProfile(true); }} />}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showProfile && user && <ProfileModal onClose={() => setShowProfile(false)} profileId={viewProfileId} onOpenAdmin={() => { setShowProfile(false); setAdminMode(true); window.location.hash = 'admin'; }} />}
      {showSaved && user && <SavedDrawer onClose={() => setShowSaved(false)} />}

      {/* Footer hint for admin */}
      {profile?.is_admin && (
        <button
          onClick={() => { setAdminMode(true); window.location.hash = 'admin'; }}
          className="fixed bottom-4 left-4 z-30 w-9 h-9 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-600 hover:text-red-400 flex items-center justify-center transition"
          title="Admin"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Hub />
    </AuthProvider>
  );
}
